/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { Builder, $ } from 'vs/base/browser/builder';
import URI from 'vs/base/common/uri';
import { ThrottledDelayer } from 'vs/base/common/async';
import errors = require('vs/base/common/errors');
import labels = require('vs/base/common/labels');
import paths = require('vs/base/common/paths');
import { Action, IActionRunner, IAction } from 'vs/base/common/actions';
import { prepareActions } from 'vs/workbench/browser/actionBarRegistry';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IFileStat, IResolveFileOptions, FileChangeType, FileChangesEvent, IFileChange, EventType as FileEventType, IFileService } from 'vs/platform/files/common/files';
import { FileDragAndDrop, FileFilter, FileSorter, FileController, FileRenderer, FileDataSource, FileViewletState, FileAccessibilityProvider } from 'vs/workbench/parts/files/browser/views/explorerViewer';
import lifecycle = require('vs/base/common/lifecycle');
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import * as DOM from 'vs/base/browser/dom';
import { CollapseAction, CollapsibleViewletView } from 'vs/workbench/browser/viewlet';
import { FileStat } from 'vs/workbench/parts/files/common/explorerViewModel';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkspace } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEventService } from 'vs/platform/event/common/event';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ResourceContextKey } from 'vs/platform/actions/common/resourceContextKey';
import { FtpViewletState, FtpFileDataSource, ActionRunner, FtpAccessibilityProvider, FtpFileController, FtpFileRenderer } from 'vs/workbench/parts/ftp/browser/views/ftpViewer';

import {IFtpConnectionInfo} from 'vs/workbench/parts/ftp/common/ftp';
import { IFtpService } from 'vs/platform/ftp/common/ftpService';
import { RefreshFtpSiteAction } from 'vs/workbench/parts/ftp/browser/ftpActions';

export class FtpView extends CollapsibleViewletView {
	//moduleName
	private workspace: IWorkspace;

	private viewletState: FtpViewletState;
	private ftpViewer: ITree; // This is the actual collapsible tree view that shows our files
	//private filter: FileFilter;

	// two Variables used by the Tree view (dont know exactly what they do yet)
	private resourceContext: ResourceContextKey;
	private folderContext: IContextKey<boolean>;

	private settings: any;
	private autoReveal: boolean;

	private configurationService: IFtpConfigurationService;

	constructor(
		viewletState: FtpViewletState,
		actionRunner: IActionRunner,
		settings: any,
		headerSize: number,
		@IMessageService messageService: IMessageService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IEventService private eventService: IEventService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IProgressService private progressService: IProgressService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IFtpService private ftpService: IFtpService,
		@IPartService private partService: IPartService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(actionRunner, false, nls.localize('ftpSection', "FTP Server Section"), messageService, keybindingService, contextMenuService, headerSize);

		this.workspace = contextService.getWorkspace();

		//this.settings = settings;
		this.viewletState = viewletState;
		this.actionRunner = actionRunner;
		this.autoReveal = true;

		this.resourceContext = instantiationService.createInstance(ResourceContextKey);
		this.folderContext = new RawContextKey<boolean>('ftpResourceIsFolder', undefined).bindTo(contextKeyService);
	}

	public renderHeader(container: HTMLElement): void {
		console.log("FTP View: Render head");
		const titleDiv = $('div.title').appendTo(container);
		//$('span').text(this.workspace.name).title(labels.getPathLabel(this.workspace.resource.fsPath)).appendTo(titleDiv);
		$('span').text(nls.localize('ftpServerName', "ftp://server.port")).appendTo(titleDiv);

		super.renderHeader(container);
	}

	public renderBody(container: HTMLElement): void {
		console.log("FTP View: Render body");
		this.treeContainer = super.renderViewTree(container);
		DOM.addClass(this.treeContainer, 'ftp-folders-view');
		DOM.addClass(this.treeContainer, 'show-file-icons');

		this.tree = this.createViewer($(this.treeContainer));

		if (this.toolBar) {
			this.toolBar.setActions(prepareActions(this.getActions()), [])();
		}

		console.log("FTP View: Render body END");
	}

	public getActions(): IAction[] {
		const actions: Action[] = [];

		actions.push(this.instantiationService.createInstance(RefreshFtpSiteAction, this.getViewer(), this.getInput()));
		/*actions.push(this.instantiationService.createInstance(NewFolderAction, this.getViewer(), null));
		actions.push(this.instantiationService.createInstance(RefreshViewExplorerAction, this, 'explorer-action refresh-explorer'));
		actions.push(this.instantiationService.createInstance(CollapseAction, this.getViewer(), true, 'explorer-action collapse-explorer'));
		*/
		// Set Order
		for (let i = 0; i < actions.length; i++) {
			const action = actions[i];
			action.order = 10 * (i + 1);
		}

		return actions;
	}



	public create(): TPromise<void> {

		// Update configuration
		this.configurationService = this.instantiationService.createInstance(IFtpConfigurationService);
		this.onConfigurationUpdated(configuration);

		// Load and Fill Viewer
		return this.doRefresh().then(() => {

			// Also handle configuration updates
			this.toDispose.push(this.configurationService.onDidUpdateConfiguration(e => this.onConfigurationUpdated(e.config, true)));
		});
		//return TPromise.as(null);
	}

	public focusBody(): void {
	}

	private getInput(): FileStat {
		return this.ftpViewer ? (<FileStat>this.ftpViewer.getInput()) : null;
	}

	public createViewer(container: Builder): ITree {
		console.log("FTP View: CreateViewer");
		const dataSource = this.instantiationService.createInstance(FtpFileDataSource);
		const renderer = this.instantiationService.createInstance(FtpFileRenderer, this.viewletState, this.actionRunner);
		const controller = this.instantiationService.createInstance(FtpFileController, this.viewletState);
		const accessibilityProvider = this.instantiationService.createInstance(FtpAccessibilityProvider);

		this.ftpViewer = new Tree(container.getHTMLElement(), {
			dataSource: dataSource,
			renderer: renderer,
			controller: controller,
			//sorter: new FileSorter(),
			accessibilityProvider: accessibilityProvider
		}, {
				autoExpandSingleChildren: true,
				ariaLabel: nls.localize('treeAriaLabel', "FTP Server Explorer")
			});

		this.toDispose.push(lifecycle.toDisposable(() => renderer.dispose()));

		// Update resource context based on focused element
		this.toDispose.push(this.ftpViewer.addListener2('focus', (e: { focus: FileStat }) => {
			this.resourceContext.set(e.focus && e.focus.resource);
			this.folderContext.set(e.focus && e.focus.isDirectory);
		}));

		console.log("FTP View: CreateViewer END");
		return this.ftpViewer;
	}

	public getOptimalWidth(): number {
		const parentNode = this.ftpViewer.getHTMLElement();
		const childNodes = [].slice.call(parentNode.querySelectorAll('.ftp-item > a'));

		return DOM.getLargestChildWidth(parentNode, childNodes);
	}

	/**
	 * Refresh the contents of the ftp-explorer to get up to date data from the ftp server about the file structure.
	 */
	public refresh(): TPromise<void> {
		console.log("FTP View: refresh");
		if (!this.ftpViewer || this.ftpViewer.getHighlight()) {
			return TPromise.as(null);
		}

		// Focus
		this.ftpViewer.DOMFocus();

		// Perform the refresh
		return this.doRefresh();
	}

	private doRefresh(): TPromise<void> {
		console.log("FTP View: doRefresh");
		const root = this.getInput();
		console.log(root);

		//const ftpConnInfo: IFtpConnectionInfo = { configFile: "ftp.json"};
		const ftpConnInfo: IFtpConnectionInfo = {
			hostname: "ftp.sverrirs.com",
			port: 21,
			username: "sverrirs",
			password: "Y2ykw8_2",
			remoteDir: "/sverrirs.com_subdomains/dev/vscodetest"
		};

		const promise = this.ftpService.resolveFile(this.workspace.resource, ftpConnInfo, true).then(stat =>
		{
			console.log("FTP View: doRefresh, got results");

			let ftpPromise: TPromise<void>;

			// Convert to model
			const modelStat = FileStat.create(stat);
			console.log( "FtpView" );
			console.log( modelStat );

			// First time refresh: The stat becomes the input of the viewer
			if (!root) {
					ftpPromise = this.ftpViewer.setInput(modelStat).then(() => {
						console.log("root");
						console.log(root);
						return TPromise.as(null);
					});
			}
			else {
				FileStat.mergeLocalWithDisk(modelStat, root);

				console.log("root2");
				console.log(root);

				ftpPromise = this.ftpViewer.refresh(root);
			}

			return ftpPromise;
		}, (e: any) => TPromise.wrapError(e));

		// While the ftp action is being executed show a progress bar
		this.progressService.showWhile(promise, this.partService.isCreated() ? 800 : 3200 /* less ugly initial startup */);

		return promise;
	}

	public setVisible(visible: boolean): TPromise<void> {
		console.log("FTP View: setVisible");
		return super.setVisible(visible).then(() => {

			// Show
			if (visible) {

				// If a refresh was requested and we are now visible, run it
				let refreshPromise = TPromise.as(null);
				refreshPromise = this.doRefresh();


				// Otherwise restore last used file: By Explorer selection
				return refreshPromise;
			}
		});
	}

	/**
	 * Selects and reveal the file element provided by the given resource if its found in the explorer. Will try to
	 * resolve the path from the disk in case the explorer is not yet expanded to the file yet.
	 */
	public select(resource: URI, reveal: boolean = this.autoReveal): TPromise<void> {

		// Require valid path
		if (!resource || resource.toString() === this.workspace.resource.toString()) {
			return TPromise.as(null);
		}

		// If path already selected, just reveal and return
		const selection = this.hasSelection(resource);
		if (selection) {
			return reveal ? this.reveal(selection, 0.5) : TPromise.as(null);
		}

		// First try to get the stat object from the input to avoid a roundtrip
		const root = this.getInput();
		if (!root) {
			return TPromise.as(null);
		}

		const fileStat = root.find(resource);
		if (fileStat) {
			return this.doSelect(fileStat, reveal);
		}

		// Stat needs to be resolved first and then revealed#
		const ftpConnInfo: IFtpConnectionInfo = {
			hostname: "ftp.sverrirs.com",
			port: 21,
			username: "sverrirs",
			password: "Y2ykw8_2",
			remoteDir: "/sverrirs.com_subdomains/dev/vscodetest"
		};
		return this.ftpService.resolveFile(this.workspace.resource, ftpConnInfo, true).then(stat => {

			// Convert to model
			const modelStat = FileStat.create(stat);

			// Update Input with disk Stat
			FileStat.mergeLocalWithDisk(modelStat, root);

			// Select and Reveal
			return this.ftpViewer.refresh(root).then(() => this.doSelect(root.find(resource), reveal));

		}, (e: any) => this.messageService.show(Severity.Error, e));
	}

	private hasSelection(resource: URI): FileStat {
		const currentSelection: FileStat[] = this.ftpViewer.getSelection();

		for (let i = 0; i < currentSelection.length; i++) {
			if (currentSelection[i].resource.toString() === resource.toString()) {
				return currentSelection[i];
			}
		}

		return null;
	}

	private doSelect(fileStat: FileStat, reveal: boolean): TPromise<void> {
		if (!fileStat) {
			return TPromise.as(null);
		}

		// Special case: we are asked to reveal and select an element that is not visible
		// In this case we take the parent element so that we are at least close to it.
		/*if (!this.filter.isVisible(this.tree, fileStat)) {
			fileStat = fileStat.parent;
			if (!fileStat) {
				return TPromise.as(null);
			}
		}*/

		// Reveal depending on flag
		let revealPromise: TPromise<void>;
		if (reveal) {
			revealPromise = this.reveal(fileStat, 0.5);
		} else {
			revealPromise = TPromise.as(null);
		}

		return revealPromise.then(() => {
			if (!fileStat.isDirectory) {
				this.ftpViewer.setSelection([fileStat]); // Since folders can not be opened, only select files
			}

			this.ftpViewer.setFocus(fileStat);
		});
	}
}
