import { BusPolicyError } from './chunk-X57D7T3Z.js';

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
      throw new BusPolicyError("publisher not allowed for topic", "unauthorized");
    }
    if (topic.minMessageVersion !== void 0 && message.messageVersion < topic.minMessageVersion) {
      throw new BusPolicyError("messageVersion below minimum for topic", "incompatible-version");
    }
    if (topic.maxMessageVersion !== void 0 && message.messageVersion > topic.maxMessageVersion) {
      throw new BusPolicyError("messageVersion above maximum for topic", "incompatible-version");
    }
  }
  assertCanSubscribe(messageName, subscriberId) {
    const topic = this.topics.get(messageName);
    if (!topic?.allowedSubscribers) {
      return;
    }
    if (!topic.allowedSubscribers.includes(subscriberId)) {
      throw new BusPolicyError("subscriber not allowed for topic", "unauthorized");
    }
  }
};

export { TopicRegistry };
//# sourceMappingURL=chunk-7P6AKMLD.js.map
//# sourceMappingURL=chunk-7P6AKMLD.js.map