import type { MessageBase } from '../contracts/message-base.js';
import { BusPolicyError } from './errors.js';

export interface TopicRegistration {
  readonly messageName: string;
  readonly allowedPublishers?: readonly string[];
  readonly allowedSubscribers?: readonly string[];
  readonly minMessageVersion?: number;
  readonly maxMessageVersion?: number;
}

export class TopicRegistry {
  private readonly topics = new Map<string, TopicRegistration>();

  register(registration: TopicRegistration): void {
    this.topics.set(registration.messageName, registration);
  }

  assertCanPublish(message: MessageBase): void {
    const topic = this.topics.get(message.messageName);
    if (!topic) {
      return;
    }
    if (topic.allowedPublishers && !topic.allowedPublishers.includes(message.source)) {
      throw new BusPolicyError('publisher not allowed for topic', 'unauthorized');
    }
    if (topic.minMessageVersion !== undefined && message.messageVersion < topic.minMessageVersion) {
      throw new BusPolicyError('messageVersion below minimum for topic', 'incompatible-version');
    }
    if (topic.maxMessageVersion !== undefined && message.messageVersion > topic.maxMessageVersion) {
      throw new BusPolicyError('messageVersion above maximum for topic', 'incompatible-version');
    }
  }

  assertCanSubscribe(messageName: string, subscriberId: string): void {
    const topic = this.topics.get(messageName);
    if (!topic?.allowedSubscribers) {
      return;
    }
    if (!topic.allowedSubscribers.includes(subscriberId)) {
      throw new BusPolicyError('subscriber not allowed for topic', 'unauthorized');
    }
  }
}
