import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CommandMessageSchema,
  EventMessageSchema,
  MessageBaseSchema,
  MessageKindSchema,
  QueryMessageSchema,
  SensitivitySchema,
  StateMessageSchema,
  UserContextMessageSchema,
} from '../src/schemas/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'contracts-snapshot');

const schemas: Record<string, unknown> = {
  MessageBase: MessageBaseSchema,
  MessageKind: MessageKindSchema,
  Sensitivity: SensitivitySchema,
  EventMessage: EventMessageSchema,
  CommandMessage: CommandMessageSchema,
  QueryMessage: QueryMessageSchema,
  StateMessage: StateMessageSchema,
  UserContextMessage: UserContextMessageSchema,
};

mkdirSync(outDir, { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const json = JSON.stringify(zodToJsonSchema(schema), null, 2);
  writeFileSync(join(outDir, `${name}.json`), `${json}\n`, 'utf8');
}

console.info(`Exported ${Object.keys(schemas).length} schemas to contracts-snapshot/`);
