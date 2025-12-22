export interface CartItem {
  product_id: string;
  name: string;
  qty: number;
  price: number;
  image_url: string;
  brand?: string;
  material?: string;
}
