import {
  ZodEffects,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  type ZodRawShape,
  type ZodTypeAny,
} from 'zod';
import type { MessageBase } from '../contracts/message-base.js';
import { BusPolicyError } from './errors.js';

export interface TopicRegistration {
  readonly messageName: string;
  readonly allowedPublishers?: readonly string[];
  readonly allowedSubscribers?: readonly string[];
  readonly minMessageVersion?: number;
  readonly maxMessageVersion?: number;
}

interface VersionRange {
  readonly min?: number;
  readonly max?: number;
}

function unwrapObjectSchema(schema: ZodTypeAny): ZodObject<ZodRawShape> | undefined {
  if (schema instanceof ZodObject) {
    return schema;
  }
  if (schema instanceof ZodEffects) {
    const inner: unknown = schema.innerType();
    if (inner instanceof ZodObject) {
      return inner;
    }
    if (inner instanceof ZodEffects) {
      return unwrapObjectSchema(inner);
    }
  }
  return undefined;
}

function extractNumberRange(schema: ZodNumber): VersionRange {
  let min: number | undefined;
  let max: number | undefined;
  for (const check of schema._def.checks) {
    if (check.kind === 'min' && check.inclusive) {
      min = min === undefined ? check.value : Math.max(min, check.value);
    } else if (check.kind === 'max' && check.inclusive) {
      max = max === undefined ? check.value : Math.min(max, check.value);
    }
  }
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

function extractVersionRange(schema: ZodTypeAny): VersionRange {
  const object = unwrapObjectSchema(schema);
  if (!object) {
    return {};
  }
  const versionField: ZodTypeAny | undefined = object.shape.messageVersion;
  if (!versionField) {
    return {};
  }
  if (versionField instanceof ZodLiteral) {
    const value: unknown = versionField.value;
    if (typeof value === 'number') {
      return { min: value, max: value };
    }
    return {};
  }
  if (versionField instanceof ZodNumber) {
    return extractNumberRange(versionField);
  }
  return {};
}

export class TopicRegistry {
  private readonly topics = new Map<string, TopicRegistration>();

  register(registration: TopicRegistration): void {
    this.topics.set(registration.messageName, registration);
  }

  registerFromValidators(validators: Readonly<Record<string, ZodTypeAny>>): void {
    for (const [messageName, schema] of Object.entries(validators)) {
      if (this.topics.has(messageName)) {
        continue;
      }
      const range = extractVersionRange(schema);
      this.topics.set(messageName, {
        messageName,
        ...(range.min !== undefined ? { minMessageVersion: range.min } : {}),
        ...(range.max !== undefined ? { maxMessageVersion: range.max } : {}),
      });
    }
  }

  static fromValidators(validators: Readonly<Record<string, ZodTypeAny>>): TopicRegistry {
    const registry = new TopicRegistry();
    registry.registerFromValidators(validators);
    return registry;
  }

  getRegistration(messageName: string): TopicRegistration | undefined {
    return this.topics.get(messageName);
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
