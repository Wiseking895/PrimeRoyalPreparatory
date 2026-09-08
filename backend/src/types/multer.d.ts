/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string
      originalname: string
      encoding: string
      mimetype: string
      size: number
      destination: string
      filename: string
      path: string
      buffer: Buffer
    }
  }
}

declare module 'multer' {
  import type { Request, RequestHandler } from 'express'

  interface Options {
    storage?: any
    limits?: {
      fileSize?: number
      files?: number
      fields?: number
      fieldPaths?: number
      fieldNameSize?: number
      parts?: number
      headerPairs?: number
    }
    fileFilter?: (req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => void
  }

  interface Multer {
    single(fieldname: string): RequestHandler
    array(fieldname: string, maxCount?: number): RequestHandler
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler
    none(): RequestHandler
  }

  function multer(options?: Options): Multer
  namespace multer {
    function memoryStorage(): any
    function diskStorage(options: { destination?: string | ((req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => void); filename?: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => void }): any
  }

  export = multer
}
