// Utility functions for invoice generation (legacy fallback; prefer generateNextInvoiceNumber in route)
export const generateInvoiceNumber = (): string => {
  return `INV#001`;
};

export const formatInvoiceFilename = (
  invoiceNumber: string,
  date: Date,
  customerName?: string
): string => {
  const dateStr = date.toISOString().split('T')[0];
  const customer = customerName
    ? customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    : 'customer';
  return `${invoiceNumber}_${dateStr}_${customer}.pdf`;
};




