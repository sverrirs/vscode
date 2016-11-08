/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import URI from 'vs/base/common/uri';
import { IEditorOptions } from 'vs/editor/common/editorCommon';
import { EncodingMode, IWorkbenchEditorConfiguration } from 'vs/workbench/common/editor';
import { FileStat } from 'vs/workbench/parts/files/common/explorerViewModel';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

/**
 * Ftp viewlet id.
 */
export const VIEWLET_ID = 'workbench.view.ftp';

export const FtpViewletVisible = new RawContextKey<boolean>('ftpViewletVisible', true);

// Service config
export interface IFtpConnectionInfo {
		hostname: string;

		port: number;

		username: string;

		password: string;

		remoteDir: string;
}

//configurationService.getConfiguration

export interface IFtpConfiguration {
	sites:{ [key: string]: {
		local: string,  // local workspace path
		remote: IFtpConnectionInfo
	} };
}

export interface IFtpFileResource {
	resource: URI;
	isDirectory: boolean;
}