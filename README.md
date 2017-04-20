# IoT Plugin for Skygear

## NodeJS SDK

[Source][sdk-src]

[API Doc][sdk-doc]

## Devices

Each IoT device must provide a `platform` interface object to the SDK:

```js
{
  action: { // platform specific action, all optional.
    shutdown: async function() {}
    restart: async function() {}
  },
  // return a string that is unique to the hardware
  // could be SoC model + serial number
  deviceSecret: string
  appVersion: string
}
```

Each device has:

* a `deviceSecret` provided by the hardware
* a `deviceID` after registration
* a `loginID` after logging in (like a session ID)

## Users and Roles

There are 2 Skygera IoT specific roles:
* `iot-device` can call device-specific lambdas.
* `iot-manager` can read/write `iot_*` tables and send messages to devices using a lambda.

## Database Schema

* `iot_device`  (ACL: public = no, iot-manager = rw)
    * _id (skygear user id)
    * secret (string)
    * class (string)
    * active (bool, true unless the device has been de-registered)

* `iot_device_login` (ACL: public = no, iot-manager = rw)
    * deviceID (FK: `iot_device._id`)
    * sdkVersion (string)
    * appVersion (string)

* `iot_device_status` (ACL: public = no, iot-manager = rw)
    * deviceID (FK: `iot_device._id`)
    * loginID (FK: `iot_device_login._id`)
    * status (online, offline)
    * metadata (JSON)

### Determining Device Status

A device is online iff the latest `iot_device_status` record is created within X minutes of the current time AND the `status` field is `online`.


## PubSub

* `iot-request-status`
    A channel for the server to globally request status reports from all devices subscribing to it.

* `iot-<SHA256(deviceSecret)>`
    A secure channel for the server to send messages to a device, payload must be an object with atleast 1 key: "action".
    Users should use these channels via the `iot:device-publish` lambda.
    Some pre-defined actions are:
    * `iot-shutdown`
    * `iot-restart`
```
{
  action: "",
  ...
}
```

## Lambda

* `iot:add-device-role()` (requires `iot-device` role)
  * Adds the role `iot-device` to the request user

* `iot:report-status({deviceID: "", loginID: "", status: "online"})` (requires `iot-device` role)
  * Used by devices to report its current status

* `iot:device-publish([deviceID, payload])` (requires master key OR `iot-manager` role)
  * Publish messages to device's secure channels, payloads must be an object with at least an "action" key.
    All actions prefixed with `iot-` will be executed by the device platform (supplied by the device `platform.action` map)

* `iot:log(message)` (requires `iot-device` role)
  * Logs message to the skygear portal


[sdk-src]: https://github.com/SkygearIO/iot-sdk-js
[sdk-doc]: https://rawgit.com/SkygearIO/iot-SDK-JS/master/doc/
