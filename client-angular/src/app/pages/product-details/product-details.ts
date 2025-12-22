// src/app/pages/product-details/product-details.ts
import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Product } from '../../models/product';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-details.html',      // <── match real file name
  styleUrls: ['./product-details.scss']
})
export class ProductDetail {

  private router = inject(Router);

  private _product = signal<Product | null>(null);
  product = computed(() => this._product());

  constructor() {
    // Prefer navigation state, fallback to history.state
    const nav = this.router.getCurrentNavigation();
    const navState = (nav?.extras?.state as any) || {};
    const fromHistory = (window.history.state as any) || {};

    const p = navState.product || fromHistory.product || null;
    if (p) {
      this._product.set(p as Product);
    } else {
      console.warn('No product found in navigation state.');
    }
  }
  goBack() {
   this.router.navigate(['/products']);
  }
}
