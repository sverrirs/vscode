/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService, IConfigurationValue } from 'vs/platform/configuration/common/configuration';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

/**
 * The location of the workspace ftp configuration file,
 * this will be stored in a hidden folder at the root of the workspace project
 */
export const FTP_CONFIG_FOLDER_DEFAULT_NAME = '.vscode';
export const FTP_CONFIG_FILE_DEFAULT_NAME = 'ftp';
export const FTP_CONFIG_FILE = '.vscode/ftp.json';

export const IFtpConfigurationService = createDecorator<IFtpConfigurationService>('ftpConfigurationService');

export interface IFtpConfigurationService extends IConfigurationService {
	/**
	 * Returns iff the workspace has a FTP configuration or not.
	 */
	hasFtpConfiguration(): boolean;

	/**
	 * Override for the IConfigurationService#lookup() method that adds information about ftp settings.
	 */
	lookup<T>(key: string): IFtpConfigurationValue<T>;
}

export interface IFtpConfigurationValue<T> extends IConfigurationValue<T> {
	ftp: T;
}