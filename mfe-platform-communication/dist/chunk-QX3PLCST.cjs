'use strict';

var chunkYZPRVI4W_cjs = require('./chunk-YZPRVI4W.cjs');

// src/core/registry.ts
var TopicRegistry = class {
  topics = /* @__PURE__ */ new Map();
  register(registration) {
    this.topics.set(registration.messageName, registration);
  }
  assertCanPublish(message) {
    const topic = this.topics.get(message.messageName);
    if (!topic) {
      return;
    }
    if (topic.allowedPublishers && !topic.allowedPublishers.includes(message.source)) {
      throw new chunkYZPRVI4W_cjs.BusPolicyError("publisher not allowed for topic", "unauthorized");
    }
    if (topic.minMessageVersion !== void 0 && message.messageVersion < topic.minMessageVersion) {
      throw new chunkYZPRVI4W_cjs.BusPolicyError("messageVersion below minimum for topic", "incompatible-version");
    }
    if (topic.maxMessageVersion !== void 0 && message.messageVersion > topic.maxMessageVersion) {
      throw new chunkYZPRVI4W_cjs.BusPolicyError("messageVersion above maximum for topic", "incompatible-version");
    }
  }
  assertCanSubscribe(messageName, subscriberId) {
    const topic = this.topics.get(messageName);
    if (!topic?.allowedSubscribers) {
      return;
    }
    if (!topic.allowedSubscribers.includes(subscriberId)) {
      throw new chunkYZPRVI4W_cjs.BusPolicyError("subscriber not allowed for topic", "unauthorized");
    }
  }
};

exports.TopicRegistry = TopicRegistry;
//# sourceMappingURL=chunk-QX3PLCST.cjs.map
//# sourceMappingURL=chunk-QX3PLCST.cjs.map