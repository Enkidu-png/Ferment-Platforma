import { createTRPCRouter, baseProcedure } from '@/trpc/init';

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    return { user: ctx.user ?? null };
  }),
});
