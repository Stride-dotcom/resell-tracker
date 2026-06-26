export type ItemStatus = 'available' | 'listed' | 'consigned' | 'sold' | 'paid'
export type ChannelKind = 'consignment' | 'marketplace' | 'buyer'
export type MediaKind = 'item_photo' | 'check_photo' | 'receipt' | 'agreement'
export type PaymentMethod = 'cash' | 'check' | 'venmo' | 'paypal' | 'zelle' | 'other'

export interface RetailLink {
  label?: string
  url: string
  price?: number | null
}

export interface Channel {
  id: string
  owner_id: string
  name: string
  kind: ChannelKind
  contact: string | null
  commission_pct: number | null
  notes: string | null
  created_at: string
}

export interface Item {
  id: string
  owner_id: string
  inventory_no: string | null
  title: string
  vendor: string | null
  description: string | null
  details: string | null
  notes: string | null
  retail_links: RetailLink[]
  retail_price: number | null
  status: ItemStatus
  channel_id: string | null
  sold_to: string | null
  tracking_number: string | null
  date_sent: string | null
  listed_price: number | null
  sold_price: number | null
  payout: number | null
  date_sold: string | null
  date_paid: string | null
  payment_method: PaymentMethod | null
  check_number: string | null
  is_public: boolean
  share_token: string | null
  public_expires_at: string | null
  created_at: string
  updated_at: string
  // joined
  channel?: Channel | null
}

export interface Media {
  id: string
  owner_id: string
  item_id: string
  kind: MediaKind
  path: string
  caption: string | null
  sort_order: number
  created_at: string
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  available: 'Available',
  listed: 'Listed',
  consigned: 'Consigned',
  sold: 'Sold',
  paid: 'Paid',
}
