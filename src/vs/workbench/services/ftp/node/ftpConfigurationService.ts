/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import uri from 'vs/base/common/uri';
import paths = require('vs/base/common/paths');
import extfs = require('vs/base/node/extfs');
import { RunOnceScheduler } from 'vs/base/common/async';
import collections = require('vs/base/common/collections');
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IEventService } from 'vs/platform/event/common/event';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { readFile } from 'vs/base/node/pfs';
import errors = require('vs/base/common/errors');
import { IConfigFile, consolidate, newConfigFile } from 'vs/workbench/services/configuration/common/model';
import { IConfigurationServiceEvent, getConfigurationValue } from 'vs/platform/configuration/common/configuration';
import { IFtpConfigurationService, IFtpConfigurationValue, FTP_CONFIG_FILE_DEFAULT_NAME, FTP_CONFIG_FOLDER_DEFAULT_NAME } from 'vs/platform/ftp/common/ftpConfiguration';
import { EventType as FileEventType, FileChangeType, FileChangesEvent } from 'vs/platform/files/common/files';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import Event, { Emitter } from 'vs/base/common/event';

interface IStat {
	resource: uri;
	isDirectory?: boolean;
	children?: { resource: uri; }[];
}

interface IContent {
	resource: uri;
	value: string;
}

/**
 * Wraps around the basic configuration service and adds knowledge about ftp settings.
 */
export class FtpConfigurationService implements IFtpConfigurationService, IDisposable {

	public _serviceBrand: any;

	private static RELOAD_CONFIGURATION_DELAY = 50;

	private _onDidUpdateConfiguration: Emitter<IConfigurationServiceEvent>;
	private toDispose: IDisposable[];

	private cachedConfig: any;
	private cachedftpConfig: any;

	private bulkFetchFromftpPromise: TPromise<any>;
	private ftpFilePathToConfiguration: { [relativeftpPath: string]: TPromise<IConfigFile> };
	private reloadConfigurationScheduler: RunOnceScheduler;

	private ftpSettingsRootFolder: string;

	constructor(
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IEventService private eventService: IEventService,
		@IEnvironmentService environmentService: IEnvironmentService
		//,		private ftpSettingsRootFolder: string = FTP_CONFIG_FOLDER_DEFAULT_NAME // THIS CAUSES RESOLUTION ERRORS FOR SOME REASONS
	) {

		this.ftpSettingsRootFolder= FTP_CONFIG_FOLDER_DEFAULT_NAME;
		this.toDispose = [];
		this.ftpFilePathToConfiguration = Object.create(null);

		this.cachedConfig = Object.create(null);
		this.cachedftpConfig = Object.create(null);

		this._onDidUpdateConfiguration = new Emitter<IConfigurationServiceEvent>();
		this.toDispose.push(this._onDidUpdateConfiguration);

		// TODO: Also monitor workspace changes event and re-load the config if new workspace!

		this.reloadConfigurationScheduler = new RunOnceScheduler(() => this.doLoadConfiguration().then(config => this._onDidUpdateConfiguration.fire({ config })).done(null, errors.onUnexpectedError), FtpConfigurationService.RELOAD_CONFIGURATION_DELAY);
		this.toDispose.push(this.reloadConfigurationScheduler);

		this.registerListeners();
	}

	get onDidUpdateConfiguration(): Event<IConfigurationServiceEvent> {
		return this._onDidUpdateConfiguration.event;
	}

	private registerListeners(): void {
		this.toDispose.push(this.eventService.addListener2(FileEventType.FILE_CHANGES, events => this.handleftpFileEvents(events)));
	}

	public initialize(): TPromise<void> {
		return this.doLoadConfiguration().then(() => null);
	}

	public getConfiguration<T>(section?: string): T {
		return section ? this.cachedConfig[section] : this.cachedConfig;
	}

	public lookup<C>(key: string): IFtpConfigurationValue<C> {

		return {
			default: null,
			user: null,
			ftp: getConfigurationValue<C>(this.cachedftpConfig, key),
			value: getConfigurationValue<C>(this.getConfiguration(), key)
		};
	}

	public reloadConfiguration(section?: string): TPromise<any> {

		// Reset caches to ensure we are hitting the disk
		this.bulkFetchFromftpPromise = null;
		this.ftpFilePathToConfiguration = Object.create(null);

		// Load configuration
		return this.doLoadConfiguration(section);
	}

	private doLoadConfiguration(section?: string): TPromise<any> {

		// Load ftp locals
		return this.loadftpConfigFiles().then(ftpConfigFiles => {

			// Consolidate (support *.json files in the ftp settings folder)
			const ftpConfig = consolidate(ftpConfigFiles).contents;
			this.cachedftpConfig = ftpConfig;
			return ftpConfig;

		}).then(result => {
			this.cachedConfig = result;

			return this.getConfiguration(section);
		});
	}

	public hasFtpConfiguration(): boolean {
		return !!this.ftpFilePathToConfiguration[`${this.ftpSettingsRootFolder}/${FTP_CONFIG_FILE_DEFAULT_NAME}.json`];
	}

	public dispose(): void {
		this.toDispose = dispose(this.toDispose);
	}

	private loadftpConfigFiles(): TPromise<{ [relativeftpPath: string]: IConfigFile }> {

		// Return early if we don't have a workspace
		if (!this.contextService.getWorkspace()) {
			return TPromise.as(Object.create(null));
		}

		// once: when invoked for the first time we fetch *all* json files using the bulk stats and content routes
		if (!this.bulkFetchFromftpPromise) {
			this.bulkFetchFromftpPromise = resolveStat(this.contextService.toResource(this.ftpSettingsRootFolder)).then(stat => {
				if (!stat.isDirectory) {
					return TPromise.as([]);
				}

				return resolveContents(stat.children.filter(stat => paths.extname(stat.resource.fsPath) === '.json').map(stat => stat.resource));
			}, (err) => {
				if (err) {
					return []; // never fail this call
				}
			}).then((contents: IContent[]) => {
				contents.forEach(content => this.ftpFilePathToConfiguration[this.contextService.toWorkspaceRelativePath(content.resource)] = TPromise.as(newConfigFile(content.value)));
			}, errors.onUnexpectedError);
		}

		// on change: join on *all* configuration file promises so that we can merge them into a single configuration object. this
		// happens whenever a config file changes, is deleted, or added
		return this.bulkFetchFromftpPromise.then(() => TPromise.join(this.ftpFilePathToConfiguration));
	}

	private handleftpFileEvents(event: FileChangesEvent): void {
		const events = event.changes;
		let affectedByChanges = false;

		// Find changes that affect workspace configuration files
		for (let i = 0, len = events.length; i < len; i++) {
			const ftpPath = this.contextService.toWorkspaceRelativePath(events[i].resource);
			if (!ftpPath) {
				continue; // event is not inside workspace
			}

			// Handle case where ".vscode" got deleted
			if (ftpPath === this.ftpSettingsRootFolder && events[i].type === FileChangeType.DELETED) {
				this.ftpFilePathToConfiguration = Object.create(null);
				affectedByChanges = true;
			}

			// outside my folder or not a *.json file
			if (
				paths.extname(ftpPath) !== '.json' ||							// we only care about *.json files
				paths.dirname(ftpPath) !== this.ftpSettingsRootFolder	// which are top level in .vscode
			) {
				continue;
			}

			// insert 'fetch-promises' for add and update events and
			// remove promises for delete events
			switch (events[i].type) {
				case FileChangeType.DELETED:
					affectedByChanges = collections.remove(this.ftpFilePathToConfiguration, ftpPath);
					break;
				case FileChangeType.UPDATED:
				case FileChangeType.ADDED:
					this.ftpFilePathToConfiguration[ftpPath] = resolveContent(events[i].resource).then(content => newConfigFile(content.value), errors.onUnexpectedError);
					affectedByChanges = true;
			}
		}

		// trigger reload of the configuration if we are affected by changes
		if (affectedByChanges && !this.reloadConfigurationScheduler.isScheduled()) {
			this.reloadConfigurationScheduler.schedule();
		}
	}

	public set telemetryService(value: ITelemetryService) {
	}
}

// node.hs helper functions

function resolveContents(resources: uri[]): TPromise<IContent[]> {
	const contents: IContent[] = [];

	return TPromise.join(resources.map(resource => {
		return resolveContent(resource).then(content => {
			contents.push(content);
		});
	})).then(() => contents);
}

function resolveContent(resource: uri): TPromise<IContent> {
	return readFile(resource.fsPath).then(contents => ({ resource, value: contents.toString() }));
}

function resolveStat(resource: uri): TPromise<IStat> {
	return new TPromise<IStat>((c, e) => {
		extfs.readdir(resource.fsPath, (error, children) => {
			if (error) {
				if ((<any>error).code === 'ENOTDIR') {
					c({ resource });
				} else {
					e(error);
				}
			} else {
				c({
					resource,
					isDirectory: true,
					children: children.map(child => { return { resource: uri.file(paths.join(resource.fsPath, child)) }; })
				});
			}
		});
	});
}