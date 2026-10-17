# Mundo v9 — jardim com folhas e flores modeladas

Fonte: `archipelago-v9.blend`, baseada em `archipelago-v8.blend`. Os sete pavilhões com mobiliário, transformações, IDs, hit nodes, seis pontes e câmeras foram preservados. Nenhum arquivo v8 foi substituído. Modelos públicos: `public/experience/world/archipelago-v9.glb` e `archipelago-v9-low.glb`; contrato: `manifest-v9.json` e `nodes-contract-v9.json`.

As copas usam lâminas curvas individuais, nervuras e pontas estreitas, em vez de volumes esféricos fechados. Galhos, raízes e folhas têm formas assimétricas; o sub-bosque reúne folhas perfuradas, samambaias, gramíneas, rosetas, brácteas curvas e pétalas arredondadas. A entrada recebeu canteiros mais densos. As copas de Validação e Especificação foram adensadas depois da inspeção do render. Folhas e flores compartilham apenas pivôs de folhagem; troncos permanecem separados. O agrupamento por material e pivô reduz os modelos a 95 meshes e 335 primitivas, contra 111 meshes e 339 primitivas no v8.

São ilustrações ornamentais inspiradas em plantas encontradas em jardins brasileiros. Os nomes internos de espécies ajudam a organizar a modelagem; não equivalem a identificação botânica, reconstrução de um ecossistema ou plantio exclusivamente nativo. A composição continua estilizada. As folhas palmadas e flores tubulares dos ipês foram orientadas pela descrição de [Handroanthus do PlantNET](https://plantnet.rbgsyd.nsw.gov.au/cgi-bin/NSWfl.pl?lvl=gn&name=Handroanthus&page=nswfl); as folhas cortadas e perfuradas de Monstera, pela descrição do [Kew](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87478-1/general-information). Toda geometria nova é própria. Não foram usados modelos, fotografias ou planos de imagem externos; texturas CC0 já presentes no projeto foram mantidas com sua proveniência existente.

`lake_water` tem 3.221 vértices, superfície local XZ no glTF (Y=0), altura mundial Y=-0,16. O centro livre para os seis peixes de runtime está documentado no contrato. Não há peixes estáticos duplicados no GLB. Os três alvos de raio são os picos geométricos de pedras visíveis na margem; os verificadores confirmam o ponto real, visibilidade e distância dos pavilhões. Movimentos, som, clima e peixes são responsabilidade do runtime.

Rebuild, em PowerShell a partir de `G:\site-tcc`, usando o Blender portable 4.5.14 já instalado:

```powershell
$v9Blender = '.sites-runtime/tools/blender/blender-4.5.14-windows-x64/blender.exe'
& $v9Blender --background --threads 4 --python scripts/world/build_world_v9.py -- --skip-export
& $v9Blender --background --threads 4 assets/world/archipelago-v9.blend --python scripts/world/refine_foliage_v9.py
& $v9Blender --background --threads 4 assets/world/archipelago-v9.blend --python scripts/world/optimize_batches_v9.py
& $v9Blender --background --threads 4 assets/world/archipelago-v9.blend --python scripts/world/refine_exports_v9.py
& $v9Blender --background --threads 4 assets/world/archipelago-v9.blend --python scripts/world/render_archipelago_v9.py
python scripts/world/finish_archipelago_v9.py
& $v9Blender --background --threads 4 assets/world/archipelago-v9.blend --python scripts/world/verify_source_v9.py
python scripts/world/verify_assets_v9.py
```

Execute cada etapa somente depois de confirmar sua conclusão. Os candidatos GLB passam pelos limites antes de substituir os modelos públicos. Orçamentos decimais: high ≤8.000.000 bytes, low ≤4.000.000 bytes, poster WebP ≤160.000 bytes. Draco reduz os dois GLBs; o low mantém grupos inteiros de folhas/pétalas e simplifica detalhes menores. Os oito renders EEVEE são gerados do source final: poster 1800×1350, sete editoriais 1200×780 e sete thumbnails derivados de 512×333. `finish_archipelago_v9.py` rejeita renders anteriores à última gravação do source.

Evidências: `build-report-v9.json` contém medidas e hashes; `verification-source-v9.json` compara a geometria e transformação dos pavilhões/pontes com v8; `framing-v9.json` confirma projeções reais em desktop, portrait e poster; `verification-v9.json` valida contratos, GLBs, compressão, budgets e proveniência das imagens. Essas verificações estáticas não substituem a inspeção do runtime em navegador.
