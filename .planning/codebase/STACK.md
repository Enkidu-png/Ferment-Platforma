# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.x - Used throughout codebase for type safety in both frontend and backend
- JavaScript (JSX/TSX) - React components and configuration files

**Secondary:**
- CSS/Tailwind CSS - Styling with Tailwind CSS v4

## Runtime

**Environment:**
- Node.js (version unspecified, assumed LTS)

**Package Manager:**
- npm / Bun - Package management
- Lockfile: `package-lock.json` present (also `bun.lock` detected)

## Frameworks

**Core:**
- Next.js 15.2.8 - Full-stack React framework with App Router
- React 19.0.0 - UI component library
- React DOM 19.0.0 - DOM rendering

**Backend/CMS:**
- Payload CMS 3.34.0 - Headless CMS with MongoDB integration
  - Features: Multi-tenant support, GraphQL API, Admin panel
- @payloadcms/next 3.34.0 - Next.js integration for Payload CMS
- @payloadcms/plugin-multi-tenant 3.34.0 - Multi-tenancy plugin for Payload
- @payloadcms/richtext-lexical 3.34.0 - Rich text editor
- @payloadcms/payload-cloud 3.34.0 - Payload Cloud integration
- @payloadcms/storage-vercel-blob 3.34.0 - File storage integration

**API & RPC:**
- tRPC 11.0.3 - TypeScript-first RPC framework
  - @trpc/server 11.0.3 - Server implementation
  - @trpc/client 11.0.3 - Client implementation
  - @trpc/tanstack-react-query 11.0.3 - React Query integration
- GraphQL 16.8.1 - Query language (via Payload CMS)

**State Management & Data:**
- TanStack React Query 5.72.1 - Server state management with caching
- Zustand 5.0.3 - Lightweight client state management
- Zod 4.0.0 - Schema validation and type inference

**UI Components:**
- shadcn/ui components with Radix UI primitives
  - @radix-ui/* (14+ component libraries) - Unstyled, accessible components
  - @radix-ui/react-dialog, @radix-ui/react-popover, etc.
- Tailwind CSS 4 - Utility-first CSS framework
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional class names

**Forms & Validation:**
- react-hook-form 7.55.0 - Performant form management
- @hookform/resolvers 5.0.1 - Form resolver adapters for validation

**Utilities:**
- sharp - Image processing (used in payload.config.ts)
- date-fns 3.0.0 - Date manipulation
- lucide-react 0.468.0 - Icon library
- embla-carousel-react 8.6.0 - Carousel component
- react-resizable-panels 2.1.7 - Resizable UI panels
- react-day-picker 9.13.0 - Date picker component
- input-otp 1.4.2 - OTP input component
- vaul 1.1.2 - Drawer component
- cmdk 1.1.1 - Command menu/palette
- sonner 2.0.3 - Toast notifications
- recharts 2.15.2 - Charting library
- next-themes 0.4.6 - Theme management (dark/light mode)
- nuqs 2.4.1 - URL query string state management

**Data Serialization:**
- superjson 2.2.2 - JSON serialization for complex types (Date, Set, Map, etc.)

**Payment Processing:**
- stripe 18.0.0 - Stripe SDK for payments

**Styling & CSS:**
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind CSS
- tailwind-merge 3.1.0 - Tailwind class name merging
- tw-animate-css 1.2.5 - Animation utilities
- PostCSS 4 - CSS transformations

## Testing

**Not explicitly configured** - No test framework (Jest, Vitest) dependencies found in package.json

## Build & Development

**Bundler:**
- Next.js built-in webpack bundling

**Development Tools:**
- ESLint 9.x - Linting with next/core-web-vitals and TypeScript rules
- TypeScript 5.x - Type checking

**Development Commands:**
```bash
npm run dev          # Next.js dev server on http://localhost:3000
npm run build        # Next.js production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm generate:types  # Generate Payload CMS TypeScript types
npm run db:fresh    # Fresh database migration
npm run db:seed     # Seed database with initial data
```

## Configuration

**Environment:**
- Configured via `.env` file (see `.env.example`)
- Key env vars: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`
- Runtime detection: `NODE_ENV`, `NEXT_PUBLIC_ROOT_DOMAIN`

**Build:**
- `tsconfig.json` - TypeScript compiler options with strict mode
  - Target: ES2017
  - Module: esnext
  - Path aliases: `@/*` → `./src/*`, `@payload-config` → `./src/payload.config.ts`
  - ESM enabled
- `next.config.ts` - Next.js configuration with Payload CMS middleware
- `postcss.config.mjs` - PostCSS with Tailwind CSS plugin
- `.eslintrc` (flat config) - ESLint configuration extending Next.js rules
- `components.json` - shadcn/ui configuration with Tailwind + Radix UI

## Payload CMS Database

**Database:**
- MongoDB via @payloadcms/db-mongodb 3.34.0
- Connection: `process.env.DATABASE_URI`
- Image processing: sharp library

**Collections (from `src/payload.config.ts`):**
- Users
- Media
- Categories
- Products
- Tags
- Tenants
- Orders
- Reviews

**Admin:**
- Payload Admin Panel at `/admin`
- Authentication cookies: SameSite=None in production, domain=`NEXT_PUBLIC_ROOT_DOMAIN`

## Platform Requirements

**Development:**
- Node.js runtime
- Bun or npm package manager
- `.env` file with required secrets and configuration

**Production:**
- Node.js hosting environment or serverless (Vercel compatible)
- MongoDB instance (Atlas or self-hosted)
- Stripe account for payment processing
- Vercel Blob storage for file uploads
- Environment variables configured

---

*Stack analysis: 2026-02-23*
