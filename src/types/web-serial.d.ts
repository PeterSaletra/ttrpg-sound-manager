interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialOptions {
  baudRate: number
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

interface Serial {
  requestPort(): Promise<SerialPort>
}

interface Navigator {
  readonly serial?: Serial
}