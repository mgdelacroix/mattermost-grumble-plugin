# Mattermost Grumble Plugin

This plugin enables voice chat over an embedded Mumble server and
HTML5 client.

## API

The base URL of the plugin is
`SERVER_SITEURL/plugins/com.mattermost.mattermost-grumble-plugin`. All
the endpoints of the API accept and return `Content-Type:
application/json`.

### Create channel

- **URL**: `/create`
- **Method**: `POST`
- **Parameters**:

| Name | Type | Required |
|------|------|----------|
| name | text | true     |

- **Response**:

Response is an object representing a channel.

| Name | Type   |
|------|--------|
| id   | number |
| name | text   |

### List channels

- **URL**: `/create`
- **Method**: `GET`
- **Response**:

Response is a list of channels.

| Name | Type   |
|------|--------|
| id   | number |
| name | text   |

### Delete channels

- **URL**: `/create/{id}`
- **Method**: `DELETE`
- **Response**:

No Content.
