// src/modules/media/server/procedures.ts
import z from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const mediaRouter = createTRPCRouter({
  createRow: protectedProcedure
    .input(
      z.object({
        storage_path: z.string().min(1),
        url: z.string().url(),
        alt: z.string(),
        mime_type: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('media')
        .insert({
          storage_path: input.storage_path,
          url: input.url,
          alt: input.alt,
          mime_type: input.mime_type ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return data
    }),
})
