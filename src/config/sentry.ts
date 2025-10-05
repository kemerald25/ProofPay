import * as Sentry from '@sentry/node';

export function initializeSentry() {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || 'development',
        tracesSampleRate: 1.0,
        integrations: [
            // Add any Sentry integrations here
        ],
        beforeSend(event, hint) {
            // Filter out sensitive data
            if (event.request) {
                delete event.request.cookies;
                delete event.request.headers?.authorization;
            }
            return event;
        }
    });
}

export { Sentry };
