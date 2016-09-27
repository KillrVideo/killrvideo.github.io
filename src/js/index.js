import { sticky } from './sticky';

// Include Google Analytics when in production
if (process.env.NODE_ENV === 'production') {
  const ga = require('./google-analytics');
}

export {
  sticky
};