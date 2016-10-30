/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/ftpviewlet';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder } from 'vs/base/browser/builder';
import { Scope } from 'vs/workbench/common/memento';
import { IViewletView, Viewlet } from 'vs/workbench/browser/viewlet';
import { IActionRunner } from 'vs/base/common/actions';
import { SplitView, Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { EmptyView } from 'vs/workbench/parts/ftp/browser/views/emptyView';
import { VIEWLET_ID, FtpViewletVisible } from 'vs/workbench/parts/ftp/common/ftp';
import { FtpView } from 'vs/workbench/parts/ftp/browser/views/ftpView';

import { IFtpService } from 'vs/platform/ftp/common/ftpService';
import { FtpViewletState, ActionRunner } from 'vs/workbench/parts/ftp/browser/views/ftpViewer';

import { IStorageService } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';

export class FtpViewlet extends Viewlet {
	private viewletContainer: Builder;
	//private splitView: SplitView;
	private views: IViewletView[];

	private emptyView: EmptyView;
	private ftpView: FtpView;
	//private modifiedFilesView: EmptyView; //ModifiedFilesView;
	//private modifiedFilesVisible: boolean;

	private focusListener: IDisposable;
	private lastFocusedView: FtpView | EmptyView;

	private viewletSettings: any;
	private viewletState: FtpViewletState;
	private dimension: Dimension;

	private viewletVisibleContextKey: IContextKey<boolean>;

	// Implementing required abstract function
	public layout(dimension: Dimension): void {
		this.dimension = dimension;
		if (this.ftpView) {
			this.ftpView.layout(dimension.height, Orientation.VERTICAL);
		}
	}

	// END MINIMAL VIEWLET IMPLEMENTATION

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(VIEWLET_ID, telemetryService);

		this.views = [];

		this.viewletState = new FtpViewletState();
		this.viewletVisibleContextKey = FtpViewletVisible.bindTo(contextKeyService);

		this.viewletSettings = this.getMemento(storageService, Scope.WORKSPACE);
		//this.configurationService.onDidUpdateConfiguration(e => this.onConfigurationUpdated(e.config));
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);

		this.viewletContainer = parent.div().addClass('ftp-viewlet');

		this.addFtpView();
		this.lastFocusedView = this.ftpView;

		return TPromise.as(null);

		/*const settings = this.configurationService.getConfiguration<IFilesConfiguration>();
		return this.onConfigurationUpdated(settings);*/
	}

	/*private onConfigurationUpdated(config: IFilesConfiguration): TPromise<void> {

		this.addFtpView();

		return TPromise.as(null);
	}*/

	private addFtpView(): void {
		let ftpViewOrEmpty: FtpView | EmptyView;

		// If open editors are not visible set header size explicitly to 0, otherwise const it be computed by super class.
		const headerSize = 0; //this.openEditorsVisible ? undefined : 0;
		// If we have a workspace open, need to read ftp info if available

		if (this.contextService.getWorkspace()) {
			this.ftpView = ftpViewOrEmpty = this.instantiationService.createInstance(FtpView , this.viewletState, this.getActionRunner(), this.viewletSettings, headerSize);
		}
		else {
			this.emptyView = ftpViewOrEmpty = this.instantiationService.createInstance(EmptyView);
		}

		ftpViewOrEmpty.render(this.viewletContainer.getHTMLElement(), Orientation.VERTICAL);

		this.views.push(ftpViewOrEmpty);
	}

	public getActionRunner(): IActionRunner {
		if (!this.actionRunner) {
			this.actionRunner = new ActionRunner(this.viewletState);
		}

		return this.actionRunner;
	}

	public getActions(): IAction[] {
		if (this.ftpView) {
			return this.ftpView.getActions();
		}

		return [];
	}

	public getFtpView(): FtpView {
		return this.ftpView;
	}

	public setVisible(visible: boolean): TPromise<void> {
		this.viewletVisibleContextKey.set(visible);

		return super.setVisible(visible).then(() => {
			return TPromise.join(this.views.map((view) => view.setVisible(visible))).then(() => void 0);
		});
	}

	public focus(): void {
		super.focus();

		/*if (this.lastFocusedView && this.lastFocusedView.isExpanded() && this.hasSelectionOrFocus(this.lastFocusedView)) {
				this.lastFocusedView.focusBody();
				return;
		}

		if (this.hasSelectionOrFocus(this.ftpView)) {
			return this.ftpView.focusBody();
		}

		if (this.ftpView && this.ftpView.isExpanded()) {
			return this.ftpView.focusBody();
		}

		if (this.emptyView && this.emptyView.isExpanded()) {
			return this.emptyView.focusBody();
		}*/

		return this.ftpView.focus();
	}

	/*private hasSelectionOrFocus(view: FtpView | EmptyView): boolean {
		if (!view) {
			return false;
		}

		if (!view.isExpanded()) {
			return false;
		}

		if (view instanceof FtpView) {
			const viewer = view.getViewer();
			if (!viewer) {
				return false;
			}

			return !!viewer.getFocus() || (viewer.getSelection() && viewer.getSelection().length > 0);

		}

		return false;
	}*/


	public shutdown(): void {
		this.views.forEach((view) => view.shutdown());

		super.shutdown();
	}

	public dispose(): void {
		super.dispose();

		/*if (this.splitView) {
			this.splitView.dispose();
			this.splitView = null;
		}*/
		if (this.ftpView) {
			this.ftpView.dispose();
			this.ftpView = null;
		}
		if (this.focusListener) {
			this.focusListener.dispose();
			this.focusListener = null;
		}
	}

}
