/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import nls = require('vs/nls');
import DOM = require('vs/base/browser/dom');
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction, Action } from 'vs/base/common/actions';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';

import { CollapsibleViewletView } from 'vs/workbench/browser/viewlet';
import { CollapsibleView } from 'vs/base/browser/ui/splitview/splitview';

export class SomeFtpView extends CollapsibleViewletView {


	public renderHeader(container: HTMLElement): void {
	}

	public renderBody(container: HTMLElement): void {

	}

	public layoutBody(size: number): void {
		// no-op
	}


	public create(): TPromise<void> {
		return TPromise.as(null);
	}

	public setVisible(visible: boolean): TPromise<void> {
		return TPromise.as(null);
	}

	public focusBody(): void {
		// Ignore
	}

	protected reveal(element: any, relativeTop?: number): TPromise<void> {
		return TPromise.as(null);
	}

	public getActions(): IAction[] {
		return [];
	}

	public getSecondaryActions(): IAction[] {
		return [];
	}

	public getActionItem(action: IAction): IActionItem {
		return null;
	}

	public shutdown(): void {
		// Subclass to implement
	}
}