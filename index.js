
const {lambda} = require('./src/helper.js');

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
      return setupDatabase(skygear);
    });

    skygearCloud.every('@every 10m', _ => {
      return publishRequestStatus(skygear);
    });

    lambda(
      'iot:add-device-role', {
        userRequired: true,
      },
      addDeviceRole
    );

    lambda(
      'iot:log', {
        userRequired: true,
        roleRequired: 'iot-device'
      },
      logDeviceMessage
    );

    lambda(
      'iot:report-status', {
        userRequired: true,
        roleRequired: 'iot-device',
        inject: {skygear},
      },
      saveDeviceStatus
    );

    lambda(
      'iot:device-publish', {
        authRequired: true,
        roleRequired: 'iot-manager',
        inject: {skygear},
      },
      publishDeviceEvent
    );

  }
};


