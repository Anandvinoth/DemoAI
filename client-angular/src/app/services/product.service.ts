//services/product.service.ts
import { Injectable } from '@angular/core';
import { Product } from '../models/product';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private selectedProduct: Product | null = null;

  setSelected(p: Product) {
    this.selectedProduct = p;
  }

  getSelected(): Product | null {
    return this.selectedProduct;
  }
}
