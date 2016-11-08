/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Sverrir Sigmundarson. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import FtpClient = require('ftp'); // Manually had to add the typescript file under vscode\src\typings
import paths = require('path');
import fs = require('fs');
import os = require('os');
import crypto = require('crypto');
import assert = require('assert');

import {IFtpConnectionInfo} from 'vs/workbench/parts/ftp/common/ftp';
import { IFtpService, IRemoteFileStat } from 'vs/platform/ftp/common/ftpService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkspace } from 'vs/platform/workspace/common/workspace';

import strings = require('vs/base/common/strings');
import arrays = require('vs/base/common/arrays');
import baseMime = require('vs/base/common/mime');
import basePaths = require('vs/base/common/paths');
import { TPromise } from 'vs/base/common/winjs.base';
import types = require('vs/base/common/types');
import objects = require('vs/base/common/objects');
import extfs = require('vs/base/node/extfs');

import URI from 'vs/base/common/uri';
import nls = require('vs/nls');

import pfs = require('vs/base/node/pfs');
import encoding = require('vs/base/node/encoding');
import mime = require('vs/base/node/mime');
import flow = require('vs/base/node/flow');


export class FtpConnectionInfo implements IFtpConnectionInfo{

	public hostname: string;
	public username: string;
	public password: string;
	public port: number;
	public remoteDir: string;

	constructor(
		hostname: string,
		username: string,
		password: string,
		port: number = 21,
		remotedir: string = null)
		{
			this.hostname = hostname;
			this.username = username;
			this.password = password;
			this.port = port;
			this.remoteDir = remotedir;
		}

		public static getFtpRoot(info: IFtpConnectionInfo):URI {
			return URI.from({scheme:"ftp", authority: (info.port !== 21 ? info.hostname+":"+info.port : info.hostname), path: info.remoteDir });
		}
}

export class FtpService implements IFtpService {
	public _serviceBrand: any;

	private workspace: IWorkspace;

	constructor(
		@IWorkspaceContextService contextService: IWorkspaceContextService
	){
		this.workspace = contextService.getWorkspace();
	}

	public static toRemoteFileStat(resource: URI, list: FtpClient.ListingElement[] ):IRemoteFileStat {

		const root : IRemoteFileStat = {
			resource: resource,
			isDirectory: true,
			hasChildren: list.length > 0,
			name: paths.basename(resource.path),
			etag: undefined,
			mtime: undefined
		};

		// If there are files to read
		if( list.length > 0 )
		{
			root.children = [];

			//https://github.com/mscdex/node-ftp#required-standard-commands-rfc-959
			for (let i = 0; i < list.length; i++) {
				let item = list[i];

				let child : IRemoteFileStat = {
					resource: URI.from({scheme:'ftp', authority: resource.authority,
					path: resource.path +'/'+item.name}),
					isDirectory: item.type === 'd',
					hasChildren: undefined,
					name: item.name,
					etag: undefined,
					size: parseInt(item.size),
					mtime: item.date.valueOf()
				};

				root.children.push(child);
			}
		}

		return root;
	}

	public resolveFile(resource: URI, info: IFtpConnectionInfo, isWorkspace: boolean = false): TPromise<IRemoteFileStat>
	{
		console.log("In FTP Service");

		let remoteResource : URI;
		if( isWorkspace ){
			remoteResource = FtpConnectionInfo.getFtpRoot(info);
		} else {
			remoteResource = resource;
		}

		console.log( "resource")
		console.log(remoteResource);

		console.log( "Connecting to: "+remoteResource.toString());

		return new TPromise<IRemoteFileStat>((c, e) => {
			var ftp = new FtpClient();
			ftp.on('ready', function()
			{
				ftp.list(remoteResource.path, function(err, list) {
					if (err) {
						e(err);
					}
					ftp.end();
					console.log( list );
					c(FtpService.toRemoteFileStat(remoteResource, list));
				});
			});
			ftp.on('error', function(err){
				e(err);
			});

			ftp.connect(
			{
				host: info.hostname,
				port: info.port,
				user: info.username,
				password: info.password
			});
		});

		// General Data
		/*const dirStat: IRemoteFileStat = {
			resource: URI.parse("ftp://ftp.sverrir.com/sverrirs.com_subdomains/dev/vscodetest"),
			isDirectory: true,
			hasChildren: true,
			name: "vscodetest",
			etag: "3f4a9fc8272c01387c387b61488eaab95f39a947",
			mtime: 1477178246602
		};

		const childStat: IRemoteFileStat = {
			resource: URI.parse("ftp://ftp.sverrir.com/sverrirs.com_subdomains/dev/vscodetest/test.html"),
			isDirectory: false,
			hasChildren: true,
			name: "test.html",
			etag: "765213c91497cc2cbfe50bf5ca0073e2bb6475e7",
			mtime: 1477166222000
		};

		dirStat.children = [];
		dirStat.children.push(childStat);

		//return TPromise.as(dirStat);
		return ftpPromise;

		//return TPromise.as(null);*/
	}


}