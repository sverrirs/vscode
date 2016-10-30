/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/ftp.contribution';

import URI from 'vs/base/common/uri';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor, ToggleViewletAction } from 'vs/workbench/browser/viewlet';
import nls = require('vs/nls');
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Registry } from 'vs/platform/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IEditorRegistry, Extensions as EditorExtensions, IEditorInputFactory, EditorInput, IFileEditorInput } from 'vs/workbench/common/editor';
//import { AutoSaveConfiguration, SUPPORTED_ENCODINGS } from 'vs/platform/files/common/files';
import { EditorDescriptor } from 'vs/workbench/browser/parts/editor/baseEditor';
//import { FILE_EDITOR_INPUT_ID, VIEWLET_ID } from 'vs/workbench/parts/files/common/files';
import { VIEWLET_ID } from 'vs/workbench/parts/ftp/common/ftp';
//import { FileEditorTracker } from 'vs/workbench/parts/files/common/editors/fileEditorTracker';
//import { SaveErrorHandler } from 'vs/workbench/parts/files/browser/saveErrorHandler';
//import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
//import { TextFileEditor } from 'vs/workbench/parts/files/browser/editors/textFileEditor';
//import { BinaryFileEditor } from 'vs/workbench/parts/files/browser/editors/binaryFileEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SyncDescriptor, AsyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IKeybindings } from 'vs/platform/keybinding/common/keybinding';
import { IViewletService } from 'vs/workbench/services/viewlet/common/viewletService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';

// Viewlet Action
export class OpenFtpViewletAction extends ToggleViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = nls.localize('showFtpViewlet', "Show FTP Sites");

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService
	) {
		super(id, label, VIEWLET_ID, viewletService, editorService);
	}
}

// Register Viewlet
Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(new ViewletDescriptor(
	'vs/workbench/parts/ftp/browser/ftpViewlet',
	'FtpViewlet',
	VIEWLET_ID,
	nls.localize('ftpsites', "FTP Sites"),
	'ftpsites',
	0
));

// Default keybinding
const openViewletKb: IKeybindings = {
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_Q
};

// Register Action to Open Viewlet
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(OpenFtpViewletAction, OpenFtpViewletAction.ID, OpenFtpViewletAction.LABEL, openViewletKb),
	'View: Show FTP Sites',
	nls.localize('view', "View")
);