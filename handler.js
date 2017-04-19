
const crypto = require('crypto');
const {query} = require('./helper.js');


function setupDatabase(skygear) {
  console.log('[Skygear IoT] Setting up DB schema...');
  return Promise.resolve()
    .then(_ => query("INSERT INTO _role VALUES ('iot-device') ON CONFLICT DO NOTHING;"))
    .then(_ => query("INSERT INTO _role VALUES ('iot-manager') ON CONFLICT DO NOTHING;"))
    .then(_ => skygear.sendRequestObject(
      'schema:create', {
        _from_plugin: true,
        record_types: {
          iot_device: {
            fields: [
              {name: 'secret' , type: 'string'},
              {name: 'class'  , type: 'string'},
              {name: 'active' , type: 'boolean'},
            ]
          }
        }
      }
    ))
    .then(_ => skygear.sendRequestObject(
      'schema:create', {
        _from_plugin: true,
        record_types: {
          iot_device_login: {
            fields: [
              {name: 'deviceID'   , type: 'ref(iot_device)'},
              {name: 'sdkVersion' , type: 'string'},
              {name: 'appVersion' , type: 'string'},
            ]
          }
        }
      }
    ))
    .then(_ => skygear.sendRequestObject(
      'schema:create', {
        _from_plugin: true,
        record_types: {
          iot_device_status: {
            fields: [
              {name: 'deviceID' , type: 'ref(iot_device)'},
              {name: 'loginID'  , type: 'ref(iot_device_login)'},
              {name: 'status'   , type: 'string'},
              {name: 'metadata' , type: 'json'},
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


function addDeviceRole({opt: {context: {user_id: deviceID}}}) {
  // TODO: validate that client is a device using API key when possible
  return query(
    "INSERT INTO _user_role VALUES ($1, 'iot-device') ON CONFLICT DO NOTHING;",
    [deviceID]
  ).then(_ => ({result: 'OK'}));
}


function logDeviceMessage({
  req: {args: message},
  opt: {context: {user_id: deviceID}}
}) {
  console.log(`[IoT Device ${deviceID}] ${message}`);
  return {result: 'OK'};
}


function saveDeviceStatus({
  skygear,
  req: {args: statusReport}
}) {
  const statusRecord = new skygear.Record(
    'iot_device_status', {
      deviceID: new skygear.Reference(
        `iot_device/${statusReport.deviceID}`
      ),
      loginID:  new skygear.Reference(
        `iot_device_login/${statusReport.loginID}`
      ),
      status:   statusReport.status,
      metadata: statusReport.metadata,
    }
  );
  statusRecord.setAccess(
    new skygear.ACL([
      {role: 'iot-manager', level: 'write'}
    ])
  );
  return skygear.publicDB.save(statusRecord)
    .then(_ => ({result: 'OK'}));
}


function publishDeviceEvent({
  skygear,
  req: {args: [deviceID, data]}
}) {
  return query("SELECT secret FROM iot_device WHERE _id = $1", [deviceID])
    .then(result => {
      const secretHash = crypto.createHash('sha256');
      secretHash.update(result.rows[0].secret);
      const channel = 'iot-' + secretHash.digest('hex');
      skygear.pubsub.publish(channel, data);
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

