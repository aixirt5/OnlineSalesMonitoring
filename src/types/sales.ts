export interface Order {
  id: number;
  order_id: number;
  log_date: string;
  datetime?: string;
  or_number: string;
  terminal_no: string;
  trn: string;
  table_no: string;
  guest_no: number;
  mandated_no: number;
  is_finish: boolean;
  is_cancelled: boolean;
  is_suspended: boolean;
  cashier_name: string;
  unit_price: number;
  total_amount: number;
  addon_amount: number;
  amount_discount: number;
  service_charge: number;
  net_total: number;
  branch_code: string;
  branch_name: string;
  branch_address: string;
  created_at: string;
  details?: OrderDetail[];
  tax_detail?: OrderTaxDetail;
  payments?: OrderPayment[];
}

export interface OrderDetail {
  id: number;
  order_detail_id: string;
  order_id: number;
  log_date: string;
  datetime: string;
  terminal_no: string;
  unit_price: number;
  total_amount: number;
  amount: number;
  discount_amount: number;
  service_charge: number;
  addon_amount: number;
  amount_refund: number;
  qty_refund: number;
  category_id: number;
  category_name: string;
  menu_name: string;
  menu_id: number;
  item_qty: number;
  discount_name: string;
  mandated_discount: string;
  voided: boolean;
  refunded: boolean;
  branch_code: string;
  created_at: string;
  compositions?: OrderComposition[];
}

export interface OrderComposition {
  id: number;
  order_detail_id: string;
  compo_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  amount: number;
  is_addon: boolean;
  voided: boolean;
  terminal_code: string;
  branch_code: string;
  created_at: string;
}

export interface OrderTaxDetail {
  order_id: number;
  branch_code: string;
  terminal_no: string;
  vatable_sales: number;
  vat_amount: number;
  vat_exempt: number;
  zero_rated: number;
  sc_vat_deduction: number;
  log_date: string;
  datetime: string;
  created_at: string;
}

export interface OrderPayment {
  id: number;
  order_id: number;
  log_date: string;
  datetime: string;
  tender_type: string;
  charge_type: string;
  tender_amount: number;
  refund_amount: number;
  change_amount: number;
  is_cancelled: boolean;
  terminal_no: string;
  branch_code: string;
  created_at: string;
} 