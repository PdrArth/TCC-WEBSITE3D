import {readFile,writeFile} from "node:fs/promises";
import {createEnvironmentManifest} from "../../src/lib/experience/environment.mjs";
const root=new URL("../../",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("public/experience/world/manifest-v9.json",root),"utf8"));
manifest.schemaVersion=3;
manifest.version=14;
manifest.environment=createEnvironmentManifest();
await writeFile(new URL("public/experience/world/manifest-v14.json",root),JSON.stringify(manifest,null,2)+"\n");
