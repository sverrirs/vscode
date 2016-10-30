'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import lifecycle = require('vs/base/common/lifecycle');
import objects = require('vs/base/common/objects');
import DOM = require('vs/base/browser/dom');
import URI from 'vs/base/common/uri';
import { MIME_BINARY } from 'vs/base/common/mime';
import async = require('vs/base/common/async');
import paths = require('vs/base/common/paths');
import errors = require('vs/base/common/errors');
import { isString } from 'vs/base/common/types';
import { IAction, ActionRunner as BaseActionRunner, IActionRunner } from 'vs/base/common/actions';
import comparers = require('vs/base/common/comparers');
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { $, Builder } from 'vs/base/browser/builder';
import platform = require('vs/base/common/platform');
import glob = require('vs/base/common/glob');
import { FileLabel, IFileLabelOptions } from 'vs/workbench/browser/labels';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ContributableActionProvider } from 'vs/workbench/browser/actionBarRegistry';
import { IFilesConfiguration } from 'vs/workbench/parts/files/common/files';
import { LocalFileChangeEvent, ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IFileOperationResult, FileOperationResult, IFileStat, IFileService } from 'vs/platform/files/common/files';
import { DuplicateFileAction, ImportFileAction, PasteFileAction, keybindingForAction, IEditableData, IFileViewletState } from 'vs/workbench/parts/files/browser/fileActions';
import { IDataSource, ITree, IElementCallback, IAccessibilityProvider, IRenderer, ContextMenuEvent, ISorter, IFilter, IDragAndDrop, IDragAndDropData, IDragOverReaction, DRAG_OVER_ACCEPT_BUBBLE_DOWN, DRAG_OVER_ACCEPT_BUBBLE_DOWN_COPY, DRAG_OVER_ACCEPT_BUBBLE_UP, DRAG_OVER_ACCEPT_BUBBLE_UP_COPY, DRAG_OVER_REJECT } from 'vs/base/parts/tree/browser/tree';
import { DesktopDragAndDropData, ExternalElementsDragAndDropData } from 'vs/base/parts/tree/browser/treeDnd';
import { ClickBehavior, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { ActionsRenderer } from 'vs/base/parts/tree/browser/actionsRenderer';
import { FileStat, NewStatPlaceholder } from 'vs/workbench/parts/files/common/explorerViewModel';
import { DragMouseEvent, IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkspace } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextViewService, IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IEventService } from 'vs/platform/event/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService, IConfirmation, Severity } from 'vs/platform/message/common/message';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Keybinding } from 'vs/base/common/keybinding';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IMenuService, IMenu, MenuId } from 'vs/platform/actions/common/actions';
import { fillInActions } from 'vs/platform/actions/browser/menuItemActionItem';
import {IFtpService, IFtpConnectionInfo} from 'vs/platform/ftp/common/ftpService';
import {FileViewletState} from 'vs/workbench/parts/files/browser/views/explorerViewer';


export class FtpViewletState extends FileViewletState implements IFileViewletState {

}

export class FtpFileDataSource implements IDataSource {
	private workspace: IWorkspace;

	constructor(
		@IProgressService private progressService: IProgressService,
		@IMessageService private messageService: IMessageService,
		@IFtpService private ftpService: IFtpService, // PERHAPS THIS SHOULD BE IRemoteFileService?
		@IPartService private partService: IPartService,
		@IWorkspaceContextService contextService: IWorkspaceContextService
	) {
		this.workspace = contextService.getWorkspace();
	}

	public getId(tree: ITree, stat: FileStat): string {
		return stat.getId();
	}

	public hasChildren(tree: ITree, stat: FileStat): boolean {
		return stat.isDirectory;
	}

	public getChildren(tree: ITree, stat: FileStat): TPromise<FileStat[]> {

		console.log("FtpFileDataSource: getChildren");
		// Return early if stat is already resolved
		if (stat.isDirectoryResolved) {
			console.log("FtpFileDataSource: directory");
			return TPromise.as(stat.children);
		}
		// Resolve children and add to fileStat for future lookup
		else {

			console.log("FtpFileDataSource: resolving dir");
			// Resolve
			const ftpConnInfo: IFtpConnectionInfo = {
			hostname: "ftp.sverrirs.com",
			port: 21,
			username: "sverrirs",
			password: "Y2ykw8_2",
			remoteDir: "/sverrirs.com_subdomains/dev/vscodetest"
		};
			const promise = this.ftpService.resolveFile(stat.resource, ftpConnInfo).then(dirStat => {

				console.log("FtpFileDataSource: got dir stat");
				console.log(dirStat);

				// Convert to view model
				const modelDirStat = FileStat.create(dirStat); // NOTE here we get a remotefilestat object!

				// Add children to folder
				for (let i = 0; i < modelDirStat.children.length; i++) {
					stat.addChild(modelDirStat.children[i]);
				}

				stat.isDirectoryResolved = true;

				return stat.children;
			}, (e: any) => {
				this.messageService.show(Severity.Error, e);

				return []; // we could not resolve any children because of an error
			});

			this.progressService.showWhile(promise, this.partService.isCreated() ? 800 : 3200 /* less ugly initial startup */);

			return promise;
		}
	}

	public getParent(tree: ITree, stat: FileStat): TPromise<FileStat> {
		if (!stat) {
			return TPromise.as(null); // can be null if nothing selected in the tree
		}

		// Return if root reached
		if (this.workspace && stat.resource.toString() === this.workspace.resource.toString()) {
			return TPromise.as(null);
		}

		// Return if parent already resolved
		if (stat.parent) {
			return TPromise.as(stat.parent);
		}

		// We never actually resolve the parent from the disk for performance reasons. It wouldnt make
		// any sense to resolve parent by parent with requests to walk up the chain. Instead, the explorer
		// makes sure to properly resolve a deep path to a specific file and merges the result with the model.
		return TPromise.as(null);
	}
}


export class ActionRunner extends BaseActionRunner implements IActionRunner {
	private viewletState: FtpViewletState;

	constructor(state: FtpViewletState) {
		super();

		this.viewletState = state;
	}

	public run(action: IAction, context?: any): TPromise<any> {
		return super.run(action, { viewletState: this.viewletState });
	}
}

export class FtpFileRenderer extends ActionsRenderer implements IRenderer {
	private state: FileViewletState;

	constructor(
		state: FtpViewletState,
		actionRunner: IActionRunner,
		@IContextViewService private contextViewService: IContextViewService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super({
			actionProvider: state.actionProvider,
			actionRunner: actionRunner
		});

		this.state = state;
	}

	public getContentHeight(tree: ITree, element: any): number {
		return 22;
	}

	public renderContents(tree: ITree, stat: FileStat, domElement: HTMLElement, previousCleanupFn: IElementCallback): IElementCallback {
		const el = $(domElement).clearChildren();

		// File Rename/Add Input Field
		const editableData: IEditableData = this.state.getEditableData(stat);
		if (editableData) {
			return this.renderInputBox(el, tree, stat, editableData);
		}

		// Label
		return this.renderLabel(el, stat);
	}

	private renderLabel(container: Builder, stat: FileStat): IElementCallback {
		const label = this.instantiationService.createInstance(FileLabel, container.getHTMLElement(), void 0);

		const extraClasses = ['ftp-item'];
		label.setFile(stat.resource, { hidePath: true, isFolder: stat.isDirectory, extraClasses });

		return () => label.dispose();
	}

	private renderInputBox(container: Builder, tree: ITree, stat: FileStat, editableData: IEditableData): IElementCallback {
		const label = this.instantiationService.createInstance(FileLabel, container.getHTMLElement(), void 0);

		const extraClasses = ['ftp-item', 'ftp-item-edited'];
		const isFolder = stat.isDirectory || (stat instanceof NewStatPlaceholder && stat.isDirectoryPlaceholder());
		const labelOptions: IFileLabelOptions = { hidePath: true, hideLabel: true, isFolder, extraClasses };
		label.setFile(stat.resource, labelOptions);

		// Input field (when creating a new file or folder or renaming)
		const inputBox = new InputBox(label.element, this.contextViewService, {
			validationOptions: {
				validation: editableData.validator,
				showMessage: true
			},
			ariaLabel: nls.localize('ftpInputAriaLabel', "Type file name. Press Enter to confirm or Escape to cancel.")
		});

		const parent = paths.dirname(stat.resource.fsPath);
		inputBox.onDidChange(value => {
			label.setFile(URI.file(paths.join(parent, value)), labelOptions); // update label icon while typing!
		});

		const value = stat.name || '';
		const lastDot = value.lastIndexOf('.');

		inputBox.value = value;
		inputBox.select({ start: 0, end: lastDot > 0 && !stat.isDirectory ? lastDot : value.length });
		inputBox.focus();

		const done = async.once(commit => {
			tree.clearHighlight();

			if (commit && inputBox.value) {
				this.state.actionProvider.runAction(tree, stat, editableData.action, { value: inputBox.value });
			}

			setTimeout(() => {
				tree.DOMFocus();
				lifecycle.dispose(toDispose);
			}, 0);
		});

		const toDispose = [
			inputBox,
			DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e: IKeyboardEvent) => {
				if (e.equals(KeyCode.Enter)) {
					if (inputBox.validate()) {
						done(true);
					}
				} else if (e.equals(KeyCode.Escape)) {
					done(false);
				}
			}),
			DOM.addDisposableListener(inputBox.inputElement, 'blur', () => {
				done(inputBox.isInputValid());
			}),
			label
		];

		return () => done(true);
	}
}

// Ftp Accessibility Provider
export class FtpAccessibilityProvider implements IAccessibilityProvider {

	public getAriaLabel(tree: ITree, stat: FileStat): string {
		return nls.localize('filesFtpViewerAriaLabel', "{0}, Ftp Explorer", stat.name);
	}
}

// Ftp File Controller
export class FtpFileController extends DefaultController {
	private didCatchEnterDown: boolean;
	private state: FtpViewletState;

	private contributedContextMenu: IMenu;

	private workspace: IWorkspace;

	constructor(state: FtpViewletState,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ITelemetryService private telemetryService: ITelemetryService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super();
		//super({ clickBehavior: ClickBehavior.ON_MOUSE_UP /* do not change to not break DND */ });

		//this.contributedContextMenu = menuService.createMenu(MenuId.ExplorerContext, contextKeyService);

		this.workspace = contextService.getWorkspace();

		this.didCatchEnterDown = false;

		this.state = state;
	}

	/* protected */ public onLeftClick(tree: ITree, stat: FileStat, event: IMouseEvent, origin: string = 'mouse'): boolean {
		const payload = { origin: origin };
		const isDoubleClick = (origin === 'mouse' && event.detail === 2);
		console.log("FtpFileController: onLeftClick");

		// Handle Highlight Mode
		if (tree.getHighlight()) {

			// Cancel Event
			event.preventDefault();
			event.stopPropagation();

			tree.clearHighlight(payload);

			return false;
		}

		// Handle root
		if (this.workspace && stat.resource.toString() === this.workspace.resource.toString()) {
			tree.clearFocus(payload);
			tree.clearSelection(payload);

			return false;
		}

		// Cancel Event
		const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
		if (!isMouseDown) {
			event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
		}
		event.stopPropagation();

		// Set DOM focus
		tree.DOMFocus();

		// Expand / Collapse
		tree.toggleExpansion(stat);

		// Allow to unselect
		if (event.shiftKey && !(stat instanceof NewStatPlaceholder)) {
			const selection = tree.getSelection();
			if (selection && selection.length > 0 && selection[0] === stat) {
				tree.clearSelection(payload);
			}
		}

		// Select, Focus and open files
		else if (!(stat instanceof NewStatPlaceholder)) {
			const preserveFocus = !isDoubleClick;
			tree.setFocus(stat, payload);

			if (isDoubleClick) {
				event.preventDefault(); // focus moves to editor, we need to prevent default
			}

			tree.setSelection([stat], payload);

			if (!stat.isDirectory) {
				this.openEditor(stat, preserveFocus, event && (event.ctrlKey || event.metaKey), isDoubleClick);
			}
		}

		return true;
	}

	public onContextMenu(tree: ITree, stat: FileStat, event: ContextMenuEvent): boolean {
		console.log("FtpFileController: onContextMenu");
		if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
			return false;
		}

		event.preventDefault();
		event.stopPropagation();

		tree.setFocus(stat);

		if (!this.state.actionProvider.hasSecondaryActions(tree, stat)) {
			return true;
		}

		const anchor = { x: event.posx + 1, y: event.posy };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => {
				return this.state.actionProvider.getSecondaryActions(tree, stat).then(actions => {
					fillInActions(this.contributedContextMenu, actions);
					return actions;
				});
			},
			getActionItem: this.state.actionProvider.getActionItem.bind(this.state.actionProvider, tree, stat),
			getKeyBinding: (a): Keybinding => keybindingForAction(a.id),
			getActionsContext: (event) => {
				return {
					viewletState: this.state,
					stat,
					event
				};
			},
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					tree.DOMFocus();
				}
			}
		});

		return true;
	}

	private onEnterDown(tree: ITree, event: IKeyboardEvent): boolean {
		console.log("FtpFileController: onEnterDown");
		if (tree.getHighlight()) {
			return false;
		}

		const payload = { origin: 'keyboard' };

		const stat: FileStat = tree.getFocus();
		if (stat) {

			// Directory: Toggle expansion
			if (stat.isDirectory) {
				tree.toggleExpansion(stat);
			}

			// File: Open
			else {
				tree.setFocus(stat, payload);
				this.openEditor(stat, false, false);
			}
		}

		this.didCatchEnterDown = true;

		return true;
	}

	private onEnterUp(tree: ITree, event: IKeyboardEvent): boolean {
		console.log("FtpFileController: onEnterUp");
		if (!this.didCatchEnterDown || tree.getHighlight()) {
			return false;
		}

		const stat: FileStat = tree.getFocus();
		if (stat && !stat.isDirectory) {
			this.openEditor(stat, false, false);
		}

		this.didCatchEnterDown = false;

		return true;
	}

	private onModifierEnterUp(tree: ITree, event: IKeyboardEvent): boolean {
		if (tree.getHighlight()) {
			return false;
		}

		const stat: FileStat = tree.getFocus();
		if (stat && !stat.isDirectory) {
			this.openEditor(stat, false, true);
		}

		this.didCatchEnterDown = false;

		return true;
	}

	private onCopy(tree: ITree, event: IKeyboardEvent): boolean {
		const stat: FileStat = tree.getFocus();
		if (stat) {
			this.runAction(tree, stat, 'workbench.files.action.copyFile').done();

			return true;
		}

		return false;
	}

	private onPaste(tree: ITree, event: IKeyboardEvent): boolean {
		const stat: FileStat = tree.getFocus() || tree.getInput() /* root */;
		if (stat) {
			const pasteAction = this.instantiationService.createInstance(PasteFileAction, tree, stat);
			if (pasteAction._isEnabled()) {
				pasteAction.run().done(null, errors.onUnexpectedError);

				return true;
			}
		}

		return false;
	}

	private openEditor(stat: FileStat, preserveFocus: boolean, sideBySide: boolean, pinned = false): void {
		console.log("FtpFileController: openEditor");
		/*if (stat && !stat.isDirectory) {
			this.telemetryService.publicLog('workbenchActionExecuted', { id: 'workbench.ftp.openFile', from: 'ftpserver' });

			this.editorService.openEditor({ resource: stat.resource, options: { preserveFocus, pinned } }, sideBySide).done(null, errors.onUnexpectedError);
		}*/
	}

	private onF2(tree: ITree, event: IKeyboardEvent): boolean {
		const stat: FileStat = tree.getFocus();

		if (stat) {
			this.runAction(tree, stat, 'workbench.ftp.action.triggerRename').done();

			return true;
		}

		return false;
	}

	private onDelete(tree: ITree, event: IKeyboardEvent): boolean {
		const stat: FileStat = tree.getFocus();
		if (stat) {
			this.runAction(tree, stat, 'workbench.ftp.action.moveFileToTrash', event).done();

			return true;
		}

		return false;
	}

	private runAction(tree: ITree, stat: FileStat, id: string, event?: IKeyboardEvent): TPromise<any> {
		console.log("FtpFileController: runAction");
		return this.state.actionProvider.runAction(tree, stat, id, { event });
	}
}