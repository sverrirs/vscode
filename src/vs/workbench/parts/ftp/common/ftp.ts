/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import URI from 'vs/base/common/uri';
import { IEditorOptions } from 'vs/editor/common/editorCommon';
import { EncodingMode, EditorInput, IFileEditorInput, IWorkbenchEditorConfiguration } from 'vs/workbench/common/editor';
import { IFilesConfiguration } from 'vs/platform/files/common/files';
import { FileStat } from 'vs/workbench/parts/files/common/explorerViewModel';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

/**
 * Ftp viewlet id.
 */
export const VIEWLET_ID = 'workbench.view.ftp';

export const FtpViewletVisible = new RawContextKey<boolean>('ftpViewletVisible', true);


/*export interface IFtpFilesConfiguration extends IWorkbenchEditorConfiguration {
	ftp: {
		openEditors: {
			visible: number;
			dynamicHeight: boolean;
		};
		autoReveal: boolean;
		enableDragAndDrop: boolean;
	};
	editor: IEditorOptions;
}

export interface IFtpFileResource {
	resource: URI;
	isDirectory: boolean;
}
*/

/**
 * Helper to get a file resource from an object.
 */
/*export function asFtpResource(obj: any): IFtpFileResource {
	if (obj instanceof FileStat) {
		const stat = <FileStat>obj;

		return {
			resource: stat.resource,
			isDirectory: stat.isDirectory
		};
	}

	return null;
}
*/