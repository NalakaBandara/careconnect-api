'use strict'

// CommonJS on purpose: the agent reads this file with require(), and the project is "type": "module".
// Secrets come from environment variables, so this file is safe to commit.
exports.config = {
    app_name: [process.env.NEW_RELIC_APP_NAME || 'careconnect-api'],
    license_key: process.env.NEW_RELIC_LICENSE_KEY,
    distributed_tracing: { enabled: true },
    logging: { level: 'info', filepath: 'stdout' },
    application_logging: {
        enabled: true,
        forwarding: { enabled: true },
        local_decorating: { enabled: false }
    },
    allow_all_headers: true,
    attributes: {
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*'
        ]
    }
}
