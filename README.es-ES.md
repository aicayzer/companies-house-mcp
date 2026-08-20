

# Companies House CLI y MCP

[![npm: companies-house-cli](https://img.shields.io/npm/v/companies-house-cli?label=companies-house-cli&style=flat)](https://www.npmjs.com/package/companies-house-cli)
[![npm: companies-house-mcp](https://img.shields.io/npm/v/companies-house-mcp?label=companies-house-mcp&style=flat)](https://www.npmjs.com/package/companies-house-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat)](https://opensource.org/licenses/MIT)

Un servidor CLI y MCP no oficial para la [API de Companies House del Reino Unido](https://developer.company-information.service.gov.uk/). Busca cualquier empresa del Reino Unido, consulta a sus directivos, rastrea la propiedad, analiza las presentaciones oficiales y ejecuta un análisis de diligencia debida, directamente desde tu terminal, tus scripts o dentro de Claude, Cursor o cualquier otra herramienta de IA compatible con MCP.

Todo funciona con una clave API gratuita. Sin backend, sin suscripciones, sin intermediarios.

**Documentación:** [companies-house.uk](https://companies-house.uk)

## Instalación

**CLI** — instala el binario `ch`:

```bash
npm install -g companies-house-cli
ch config set-key your-key-here
```

**Servidor MCP** — para Claude, Cursor, Zed y otros:

```bash
npx -y companies-house-mcp
```

Ambos paquetes utilizan la misma clave API gratuita de [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk/).

## Funcionalidades

**Búsqueda y consulta**
- `search_companies` / `ch search` — busca empresas por nombre, con filtros por estado, tipo, código SIC y ubicación
- `search_officers` / `ch search-officers` — busca directivos en todas las empresas por nombre
- `get_company_profile` / `ch profile` — perfil completo de la empresa: estado, direcciones, códigos SIC, fechas clave

**Directivos y propiedad**
- `get_officers` / `ch officers` — directores, secretarios y otros responsables actuales y anteriores
- `get_appointments` — cada empresa en la que un responsable dado ha ocupado un cargo
- `get_ownership` / `ch ownership` — personas con control significativo (PSC), cadenas de propiedad corporativa

**Presentaciones y aspectos financieros**
- `get_filings` / `ch filings` — historial completo de presentaciones con enlaces a documentos, filtrable por categoría
- `get_filing_document` — obtiene un documento de presentación individual
- `get_charges` / `ch charges` — cargas e hipotecas registradas a nombre de la empresa
- `get_insolvency` / `ch insolvency` — procedimientos de insolvencia, liquidaciones y administraciones

**Diligencia debida**
- `company_report` / `ch report` — todo en una sola llamada: perfil, directivos, propiedad, cargas, presentaciones e insolvencia
- `due_diligence_check` / `ch check` — escaneo automatizado de señales de alerta con clasificaciones de severidad ALTA / MEDIA / BAJA
- `officer_network` / `ch network` — mapea las conexiones de un director en todas las empresas a las que está vinculado

**Funciones extendidas**
- `get_company_registers` — registros legales (socios, directores, secretarios, cargas)
- `get_exemptions` — exenciones de divulgación
- `get_uk_establishments` — sedes en el Reino Unido de empresas extranjeras
- `get_officer_disqualifications` — órdenes de inhabilitación emitidas contra un responsable

## Referencia rápida de la CLI

```
ch search "Anthropic"
ch profile 14604577
ch officers 14604577 --all
ch ownership 14604577
ch filings 14604577 --category accounts
ch charges 14604577
ch report 14604577
ch check 14604577
ch network "John Smith"
ch report 14604577 --json | jq '.profile.company_status'
ch report 14604577 --md > report.md
```

Referencia completa, banderas y modos de salida en [companies-house.uk/cli](https://companies-house.uk/cli).

## Configuración de MCP

Agrega a la configuración de tu cliente con tu clave API y ejecuta `npx -y companies-house-mcp`. Configuración detallada para Claude Desktop, Claude Code, Cursor y Zed en [companies-house.uk/mcp](https://companies-house.uk/mcp).

## Desarrollo

```bash
git clone https://github.com/aicayzer/companies-house-mcp.git
cd companies-house-mcp
pnpm install && pnpm build && pnpm test:unit
```

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) para la guía completa. Documentación en [companies-house.uk](https://companies-house.uk).

## Aviso legal

No está afiliado ni respaldado por Companies House ni por el Gobierno del Reino Unido. Utiliza la [API de Companies House](https://developer.company-information.service.gov.uk/) de acceso público.

## Licencia

MIT
