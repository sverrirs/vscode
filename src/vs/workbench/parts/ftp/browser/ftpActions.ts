/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

//import 'vs/css!./media/ftpactions';
import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import { Registry } from 'vs/platform/platform';
import * as network from 'vs/base/common/network';
import { isWindows, isLinux, isMacintosh } from 'vs/base/common/platform';
import { sequence, ITask } from 'vs/base/common/async';
import paths = require('vs/base/common/paths');
import URI from 'vs/base/common/uri';
import errors = require('vs/base/common/errors');
import { toErrorMessage } from 'vs/base/common/errorMessage';
import strings = require('vs/base/common/strings');
import { Event, EventType as CommonEventType } from 'vs/base/common/events';
import severity from 'vs/base/common/severity';
import diagnostics = require('vs/base/common/diagnostics');
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { Action, IAction } from 'vs/base/common/actions';
import { IMessageService, Severity, CloseAction, IMessageWithAction, IConfirmation, CancelAction} from 'vs/platform/message/common/message';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IFileService, IFileOperationResult, FileOperationResult } from 'vs/platform/files/common/files';
import { IWorkspaceConfigurationService, WORKSPACE_CONFIG_DEFAULT_PATH } from 'vs/workbench/services/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actionRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { StringEditorInput } from 'vs/workbench/common/editor/stringEditorInput';
import * as path from 'path';
import { BaseTwoEditorsAction } from 'vs/workbench/browser/actions/opensettings';

import { IFileStat, IImportResult } from 'vs/platform/files/common/files';
import { FileStat, NewStatPlaceholder } from 'vs/workbench/parts/files/common/explorerViewModel';
import { IEventService } from 'vs/platform/event/common/event';
import { IFtpService, IFtpServiceOptions} from 'vs/platform/ftp/common/ftpService';
import { ITree, IHighlightEvent } from 'vs/base/parts/tree/browser/tree';

export class BaseFtpAction extends Action {
	private _element: IFileStat;

	constructor(
		id: string,
		label: string,
		@IWorkspaceContextService private _contextService: IWorkspaceContextService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IFtpService private _ftpService: IFtpService,
		@IMessageService private _messageService: IMessageService,
		@IEventService private _eventService: IEventService
	) {
		super(id, label);

		this.enabled = false;
	}

	public get contextService() {
		return this._contextService;
	}

	public get messageService() {
		return this._messageService;
	}

	public get editorService() {
		return this._editorService;
	}

	public get ftpService() {
		return this._ftpService;
	}

	public get eventService() {
		return this._eventService;
	}

	public get element() {
		return this._element;
	}

	public set element(element: IFileStat) {
		this._element = element;
	}

	_isEnabled(): boolean {
		return true;
	}

	_updateEnablement(): void {
		this.enabled = !!(this._contextService && this._ftpService && this._editorService && this._isEnabled());
	}

	protected onError(error: any): void {
		this._messageService.show(Severity.Error, error);
	}

	protected onWarning(warning: any): void {
		this._messageService.show(Severity.Warning, warning);
	}

	protected onErrorWithRetry(error: any, retry: () => TPromise<any>, extraAction?: Action): void {
		const actions = [
			new Action(this.id, nls.localize('retry', "Retry"), null, true, () => retry()),
			CancelAction
		];

		if (extraAction) {
			actions.unshift(extraAction);
		}

		const errorWithRetry: IMessageWithAction = {
			actions,
			message: toErrorMessage(error, false)
		};

		this._messageService.show(Severity.Error, errorWithRetry);
	}
}

export class RefreshFtpSiteAction extends BaseFtpAction {
	public static ID = 'workbench.ftp.action.refreshFtpSite';

	private tree: ITree;

	constructor(
		tree: ITree,
		element: FileStat,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService,
		@IFtpService ftpService: IFtpService,
		@IMessageService messageService: IMessageService,
		@IEventService eventService: IEventService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(RefreshFtpSiteAction.ID, nls.localize('refresh', "Refresh"), contextService, editorService, ftpService, messageService, eventService);

		this.tree = tree;
		this.element = element;
		this._updateEnablement();
	}

	public run(context?: any): TPromise<any> {
		if (!context) {
			return TPromise.wrapError('No context provided to BaseEnableFileRenameAction.');
		}

		this.tree.refresh();
	}

}

export class OpenFtpSettingsAction extends BaseTwoEditorsAction {

	public static ID = 'workbench.action.ftp.openOrCreateFtpSettings';
	public static LABEL = nls.localize('openOrCreateFtpSettings', "Create New FTP Connection");


    public run(event?: any): TPromise<void> {

		const workspace = this.contextService.getWorkspace();

		// Must have an open workspace before creating ftp settings
        if (!workspace) {
			this.messageService.show(Severity.Info, nls.localize('openFolderFirstBeforeFTPSettings', "Open a folder first to create FTP settings"));

			return;
		}

        const emptySettingsContents = [
			'// ' + nls.localize('emptyFtpSettingsHeader', "Place your FTP settings in this file."),
			'{',
			'}'
		].join('\n');

		const ftpPath = path.join(workspace.resource.fsPath, 'ftp.json');

        // Create as needed (the openTwoEditors function does that for us) and open in editor
		return this.openTwoEditors(FtpSettingsInput.getInstance(this.instantiationService, this.configurationService),
                                   URI.file(ftpPath),
                                   emptySettingsContents);

		//return this.open(emptySettingsHeader, this.contextService.toResource('.vscode/ftpsettings.json'));
	}
}

class FtpSettingsInput extends StringEditorInput {
	private static INSTANCE: FtpSettingsInput;

	public static getInstance(instantiationService: IInstantiationService, configurationService: IWorkspaceConfigurationService): FtpSettingsInput {
		if (!FtpSettingsInput.INSTANCE) {
            // Todo here we would add a function call that constructs the default ftp config layout, instead of IWorkspaceConfigurationService create a FTP one for this
			const defaults = "{"+
                             "\n\t\"host\": \"\","+
                             "\n\t\"port\": 21,"+
                             "\n\t\"username\": \"\","+
                             "\n\t\"password\": \"\","+
                             "\n\t\"remotedir\": \"\","+
                             "\n\t\"passive\": false"+
                             "\n}";

			let defaultsHeader = '// ' + nls.localize('defaultSettingsHeader', "Overwrite settings by placing them into your settings file.");
			//defaultsHeader += '\n// ' + nls.localize('defaultSettingsHeader2', "See http://go.microsoft.com/fwlink/?LinkId=808995 for the most commonly used settings.");
			FtpSettingsInput.INSTANCE = instantiationService.createInstance(FtpSettingsInput, nls.localize('defaultFtpSettingsName', "Default FTP Settings"), null, defaultsHeader + '\n' + defaults, 'application/json', false);
		}

		return FtpSettingsInput.INSTANCE;
	}

	protected getResource(): URI {
		return URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: '/ftp.json' }); // URI is used to register JSON schema support
	}
}

const category = nls.localize('preferences', "Preferences");
const registry = Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenFtpSettingsAction, OpenFtpSettingsAction.ID, OpenFtpSettingsAction.LABEL), 'Preferences: Open FTP Settings', category);
