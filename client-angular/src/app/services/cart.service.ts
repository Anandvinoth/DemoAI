import { Injectable, signal } from '@angular/core';
import { CartItem } from '../models/cart-item';

@Injectable({ providedIn: 'root' })
export class CartService {

  private storageKey = 'voice_cart';

  cart = signal<CartItem[]>(this.loadInitial());

  private loadInitial(): CartItem[] {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cart()));
  }

  // ───────────────────────────────
  // ADD ITEM
  // ───────────────────────────────
  add(product: any, qty: number = 1) {
    const items = [...this.cart()];
    const existing = items.find(i => i.product_id === product.id);

    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        product_id: product.id,
        name: product.name,
        qty,
        price: product.price,
        image_url: product.image_url,
        brand: product.brand,
        material: product.material
      });
    }

    this.cart.set(items);
    this.persist();
  }

  // ───────────────────────────────
  // REMOVE / UPDATE
  // ───────────────────────────────
  updateQty(product_id: string, qty: number) {
    const items = this.cart().map(i =>
      i.product_id === product_id ? { ...i, qty } : i
    );
    this.cart.set(items);
    this.persist();
  }

  remove(product_id: string) {
    const items = this.cart().filter(i => i.product_id !== product_id);
    this.cart.set(items);
    this.persist();
  }

  clear() {
    this.cart.set([]);
    this.persist();
  }

  total() {
    return this.cart().reduce((sum, i) => sum + i.qty * i.price, 0);
  }

  count() {
    return this.cart().reduce((sum, i) => sum + i.qty, 0);
  }
}
