

# Better Media

Framework modular de pipelines multimedia para ingestión, validación, procesamiento y almacenamiento.

[**Ver Aplicación Web**](platform/README.md)

## Arquitectura

**Core define los contratos. Los adaptadores implementan la infraestructura. El framework orquesta.**

| Capa          | Paquete(s)                                                                                                                                                                                                                                                  | Responsabilidad                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Core**      | `@better-media/core`                                                                                                                                                                                                                                        | Solo interfaces (StorageAdapter, DatabaseAdapter, JobAdapter, PipelinePlugin). Sin implementaciones.   |
| **Adaptadores** | `@better-media/adapter-storage-memory`, `@better-media/adapter-storage-filesystem`, `@better-media/adapter-storage-s3`, `@better-media/adapter-db-memory`, `@better-media/adapter-db-kysely`, `@better-media/mongodb-adapter`, `@better-media/adapter-jobs` | Implementan los contratos del core (MemoryStorageAdapter, FileSystemStorageAdapter, S3StorageAdapter, etc). |
| **Framework** | `@better-media/framework`                                                                                                                                                                                                                                   | Orquestar: conectar adaptadores + complementos, ejecutar el ciclo de vida. Sin contratos o implementaciones de infraestructura. |

## Estructura del Monorepo

```
packages/
├── core/              # @better-media/core - Contracts (interfaces, types)
├── better-media/      # @better-media/framework - Framework entry, lifecycle engine
├── plugins/
│   ├── validation-plugin/     # @better-media/plugin-validation
│   ├── virus-scan-plugin/     # @better-media/plugin-virus-scan
│   └── media-processing-plugin/  # @better-media/plugin-media-processing
└── adapters/
    ├── storages/
    │   ├── storage-memory/       # @better-media/adapter-storage-memory
    │   ├── storage-filesystem/   # @better-media/adapter-storage-filesystem
    │   └── storage-s3/           # @better-media/adapter-storage-s3
    ├── databases/
    │   ├── db-memory/            # @better-media/adapter-db-memory
    │   ├── db-kysely/            # @better-media/adapter-db-kysely
    │   └── mongodb-adapter/      # @better-media/mongodb-adapter
    └── jobs/                     # @better-media/adapter-jobs
```

## Sistema de Plugins

Los plugins se ejecutan en modos **sincrónicos** o de **fondo (background)**.

```
Plugin
 ├─ name
 ├─ hooks (extensible lifecycle hooks)
 └─ execution mode
      ├─ sync      – run inline during upload
      └─ background – enqueue via job adapter
```

## Sistema de Adaptadores de Trabajo

La ejecución en segundo plano funciona mediante un adaptador de trabajo opcional. Predeterminado: en memoria.

- **sync** – El plugin se ejecuta en línea durante la carga
- **background** – El trabajo del plugin se encola mediante el adaptador de trabajo (Redis, RabbitMQ, Kafka, etc.)

### Integración con Workers

Utilice `media.runBackgroundJob(payload)` desde su proceso worker. La carga útil es serializable:

```ts
interface BackgroundJobPayload {
  fileKey: string;
  metadata: Record<string, unknown>;
  hookName: HookName;
  pluginName: string;
}
```

**Ejemplo con Bull/BullMQ:**

```ts
const media = createBetterMedia({ storage, database, jobs: bullAdapter, plugins });
const worker = new Worker("better-media:background", async (job) => {
  await media.runBackgroundJob(job.data);
});
```

**Ejemplo con Inngest:**

```ts
inngest.createFunction(
  { id: "better-media-job" },
  { event: "better-media/background" },
  async ({ event }) => {
    await media.runBackgroundJob(event.data.payload);
  }
);
```

El framework no implementa sondeo (polling) ni programación de tareas; los adaptadores y su worker se encargan de eso.

## Adaptadores de Almacenamiento

Elija una implementación de almacenamiento según su entorno:

| Adaptador        | Paquete                                    | Caso de uso                        |
| -------------- | ------------------------------------------ | ---------------------------------- |
| **Memoria**     | `@better-media/adapter-storage-memory`     | Desarrollo, pruebas                |
| **Sistema de archivos** | `@better-media/adapter-storage-filesystem` | Nodo único, disco local            |
| **S3**         | `@better-media/adapter-storage-s3`         | AWS S3, MinIO, compatible con S3   |

**Sistema de archivos** (funciona con Multer en Express/NestJS):

```ts
import { FileSystemStorageAdapter } from "@better-media/adapter-storage-filesystem";

const storage = new FileSystemStorageAdapter({ baseDir: "/var/uploads" });
```

**S3** (AWS o MinIO):

```ts
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";

const storage = new S3StorageAdapter({
  region: "us-east-1",
  bucket: "my-media-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  // For MinIO:
  // endpoint: "http://localhost:9000",
  // forcePathStyle: true,
});
```

## Inicio Rápido

```bash
pnpm install
pnpm build
```

## Scripts

| Comando          | Descripción                           |
| ---------------- | ------------------------------------- |
| `pnpm build`     | Compilar todos los paquetes           |
| `pnpm dev`       | Modo watch para todos los paquetes    |
| `pnpm typecheck` | Verificar tipos en todos los paquetes |
| `pnpm lint`      | Ejecutar linter en todos los paquetes |
| `pnpm test`      | Ejecutar pruebas                      |
| `pnpm format`    | Formatear con Prettier                |
| `pnpm changeset` | Crear un changeset para versionado    |

## Pruebas con Postman

Se proporciona una colección de Postman en el directorio raíz para ayudarle a probar los ejemplos:

- [better-media.postman_collection.json](./better-media.postman_collection.json)

La colección incluye:

- **Cargas Multipartes**: Probar la ingestión basada en Multer.
- **Cargas Binarias**: Probar la ingestión de búferes crudos.
- **Cargas Prefirmadas Unificadas**: Flujo completo para los métodos PUT y POST (paso a paso).

Para utilizarla:

1. Importe el archivo JSON en Postman.
2. Inicie un ejemplo (por ejemplo, `cd examples/express && pnpm dev`).
3. Use las variables de la colección para alternar entre Express (Puerto 6000) y NestJS (Puerto 3000).

## Agregar un Plugin

1. Cree `packages/plugins/<name>-plugin/` con `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Implemente la interfaz `PipelinePlugin` desde `@better-media/core`
3. Agregue `@better-media/core` como dependencia del workspace

## Agregar un Adaptador

1. Cree `packages/adapters/<name>/` (o agregue al almacenamiento/bd existente)
2. Implemente el contrato desde `@better-media/core` (por ejemplo, `StorageAdapter`, `DatabaseAdapter`)
3. Exporte la implementación; reexporte la interfaz desde core para mayor comodidad
4. Agregue al workspace en `pnpm-workspace.yaml` si utiliza un nuevo paquete de adaptador de nivel superior
