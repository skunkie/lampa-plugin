// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import recessConfig from 'stylelint-config-recess-order';
import propertyGroups from 'stylelint-config-recess-order/groups';

// Stylelint compares unprefixed names and treats macOS font smoothing as font smoothing.
const seenProperties = new Set();
const normalizedGroups = propertyGroups.map(group => ({
  ...group,
  properties: group.properties
    .map(property => property.replace(/^-\w+-/, '').replace(/^osx-/, ''))
    .filter(property => {
      if (seenProperties.has(property)) return false;
      seenProperties.add(property);
      return true;
    }),
}));

export default {
  ...recessConfig,
  rules: {
    ...recessConfig.rules,
    'order/properties-order': normalizedGroups,
    'property-no-unknown': true,
  },
};
