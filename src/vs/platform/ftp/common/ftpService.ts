/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import paths = require('vs/base/common/paths');
import URI from 'vs/base/common/uri';
import glob = require('vs/base/common/glob');
import events = require('vs/base/common/events');
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import {IFileStat} from 'vs/platform/files/common/files';

export const IFtpService = createDecorator<IFtpService>('ftpService');

export interface IFtpServiceOptions{
	configFile: string;
}

export interface IRemoteFileStat extends IFileStat{
}

export interface IFtpConnectionInfo {
		hostname: string;

		port: number;

		username: string;

		password: string;

		remoteDir: string;
}

export interface IFtpService {
	_serviceBrand: any;

	resolveFile(resource: URI, info: IFtpConnectionInfo, isWorkspace?: boolean): TPromise<IRemoteFileStat>;
	//resolveFile(resource: URI, options?: IFtpServiceOptions): TPromise<IRemoteFileStat>;
}