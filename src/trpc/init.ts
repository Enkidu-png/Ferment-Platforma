import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';

import { createClient } from '@/lib/supabase/server';

export const createTRPCContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
