
const crypto = require('crypto');
const { dbOperation } = require('./helper.js');

function setupDatabase(skygearCloud, skygear) {
  console.log('[Skygear IoT] Setting up DB schema...');
  return Promise.resolve()
    .then(_ => dbOperation(skygearCloud, "INSERT INTO _role VALUES ('iot-device') ON CONFLICT DO NOTHING;"))
    .then(_ => dbOperation(skygearCloud, "INSERT INTO _role VALUES ('iot-manager') ON CONFLICT DO NOTHING;"))
    .then(_ => skygear.sendRequestObject(
      'schema:create', {
        _from_plugin: true,
        record_types: {
          iot_device_login: {
            fields: [
              {name: 'deviceID'   , type: 'string'},
              {name: 'sdkVersion' , type: 'string'},
              {name: 'appVersion' , type: 'string'},
            ]
          },
          iot_device_status: {
            fields: [
              {name: 'deviceID' , type: 'string'},
              {name: 'status'   , type: 'string'},
              {name: 'metadata' , type: 'json'},
            ]
          }
        }
      }
    ))
    .then(_ => skygear.sendRequestObject(
      'schema:create', {
        _from_plugin: true,
        record_types: {
          iot_device: {
            fields: [
              {name: 'secret' , type: 'string'},
              {name: 'class'  , type: 'string'},
              {name: 'login'  , type: 'ref(iot_device_login)'},
              {name: 'status' , type: 'ref(iot_device_status)'},
              {name: 'active' , type: 'boolean'},
            ]
          }
        }
      }
    ));
}


function publishRequestStatus(skygear) {
  console.log('[Skygear IoT] Requesting device status...');
  skygear.pubsub.publish('iot-request-status', {});
}


function addDeviceRole({skygearCloud, opt: {context: {user_id: deviceID}}}) {
  // TODO: validate that client is a device using API key when possible
  return dbOperation(
    skygearCloud,
    "INSERT INTO _user_role VALUES ($1, 'iot-device') ON CONFLICT DO NOTHING;",
    [deviceID]
  ).then(_ => ({result: 'OK'}));
}


function logDeviceMessage({
  skygearCloud,
  req: {args: message},
  opt: {context: {user_id: deviceID}}
}) {
  console.log(`[IoT Device ${deviceID}] ${message}`);
  return {result: 'OK'};
}


function saveDeviceStatus({
  skygearCloud,
  skygear,
  req: {args: statusReport}
}) {
  const statusRecord = new skygear.Record(
    'iot_device_status', {
      deviceID: statusReport.deviceID,
      status:   statusReport.status,
      metadata: statusReport.metadata || {},
    }
  );
  statusRecord.setAccess(new skygear.ACL([
    { role: 'iot-device', level: 'write' },
    { role: 'iot-manager', level: 'read' },
  ]));
  return Promise.resolve()
    .then(_ => skygear.publicDB.save(statusRecord))
    .then(_ => dbOperation(
      skygearCloud,
      "UPDATE iot_device SET status = $1 WHERE _id = $2",
      [statusRecord._id, statusRecord.deviceID]
    ))
    .then(_ => ({result: 'OK'}));
}


function publishDeviceEvent({
  skygear,
  req: {args: [payload, deviceIDs]}
}) {
  return Promise.resolve()
    .then(_ => {
      return skygear.publicDB.query(
        new skygear.Query(
          new skygear.Record.extend('iot_device')
        ).contains('_id', deviceIDs)
      );
    })
    .then(results => {
      results.forEach(({ secret }) => {
        const secretHash = crypto.createHash('sha256');
        secretHash.update(secret);
        const channel = `iot-${secretHash.digest('hex')}`;
        skygear.pubsub.publish(channel, payload);
      });
    })
    .then(_ => ({result: 'OK'}));
}


module.exports = {
  setupDatabase,
  publishRequestStatus,
  addDeviceRole,
  logDeviceMessage,
  saveDeviceStatus,
  publishDeviceEvent,
};
