import crypto from 'crypto';

import { Logger } from '@rocket.chat/logger';
import { Settings } from '@rocket.chat/models';
import { v4 as uuidv4 } from 'uuid';

import { settingsRegistry, settings } from '../../app/settings/server';

const logger = new Logger('FingerPrint');

const generateFingerprint = function () {
	const siteUrl = settings.get('Site_Url');
	const dbConnectionString = process.env.MONGO_URL;

	const fingerprint = `${siteUrl}${dbConnectionString}`;
	return crypto.createHash('sha256').update(fingerprint).digest('base64');
};

const updateFingerprint = async function (fingerprint: string, verified: boolean) {
	await Settings.updateValueById('Deployment_FingerPrint_Hash', fingerprint);

	await Settings.updateValueById('Deployment_FingerPrint_Verified', verified);
};

const verifyFingerPrint = async function () {
	const DeploymentFingerPrintRecordHash = await Settings.getValueById('Deployment_FingerPrint_Hash');

	const fingerprint = generateFingerprint();

	if (!DeploymentFingerPrintRecordHash) {
		logger.info('Generating fingerprint for the first time', fingerprint);
		await updateFingerprint(fingerprint, true);
		return;
	}

	if (DeploymentFingerPrintRecordHash === fingerprint) {
		return;
	}

	if (process.env.AUTO_ACCEPT_FINGERPRINT === 'true') {
		logger.info('Updating fingerprint as AUTO_ACCEPT_FINGERPRINT is true', fingerprint);
		await updateFingerprint(fingerprint, true);
	}

	logger.warn('Updating fingerprint as pending for admin verification', fingerprint);
	await updateFingerprint(fingerprint, false);
};

settings.watch('Site_Url', () => {
	void verifyFingerPrint();
});

// Insert server unique id if it doesn't exist
export const createMiscSettings = async () => {
	await settingsRegistry.add('uniqueID', process.env.DEPLOYMENT_ID || uuidv4(), {
		public: true,
	});

	await settingsRegistry.add('Deployment_FingerPrint_Hash', '', {
		public: false,
		readonly: true,
	});

	await settingsRegistry.add('Deployment_FingerPrint_Verified', false, {
		type: 'boolean',
		public: true,
		readonly: true,
	});

	await settingsRegistry.add('Initial_Channel_Created', false, {
		type: 'boolean',
		hidden: true,
	});
};
