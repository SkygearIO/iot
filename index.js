
const { registerLambda } = require('./src/helper.js');

const {
  setupDatabase,
  publishRequestStatus,
  addDeviceRole,
  logDeviceMessage,
  saveDeviceStatus,
  publishDeviceEvent,
} = require('./src/handler.js');

module.exports = {
  includeme(skygearCloud) {
    const skygear = new skygearCloud.CloudCodeContainer();
    skygear.endPoint = skygearCloud.settings.skygearEndpoint+'/';
    skygear.apiKey = skygearCloud.settings.masterKey;
    skygear.pubsub.reconfigure();

    skygearCloud.event('before-plugins-ready', _ => {
      return setupDatabase(skygearCloud, skygear);
    });

    skygearCloud.every('@every 10m', _ => {
      return publishRequestStatus(skygear);
    });

    registerLambda(
      skygearCloud,
      'iot:add-device-role', {
        userRequired: true,
      },
      addDeviceRole
    );

    registerLambda(
      skygearCloud,
      'iot:log', {
        userRequired: true,
        roleRequired: 'iot-device'
      },
      logDeviceMessage
    );

    registerLambda(
      skygearCloud,
      'iot:report-status', {
        userRequired: true,
        roleRequired: 'iot-device',
        inject: {skygear},
      },
      saveDeviceStatus
    );

    registerLambda(
      skygearCloud,
      'iot:device-publish', {
        authRequired: true,
        roleRequired: 'iot-manager',
        inject: {skygear},
      },
      publishDeviceEvent
    );

  }
};
