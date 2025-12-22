//import { Component, inject, signal } from '@angular/core';
//import { CartService } from '../../services/cart.service';
//
//@Component({
//  selector: 'app-cart',
//  standalone: true,
//  templateUrl: './cart.page.html'
//})
//export class CartPage {
//
//  private cartService = inject(CartService);
//
//  cart = this.cartService.cart;
//  total = () => this.cartService.total();
//
//  inc(item: any) {
//    this.cartService.updateQty(item.product_id, item.qty + 1);
//  }
//
//  dec(item: any) {
//    if (item.qty > 1) {
//      this.cartService.updateQty(item.product_id, item.qty - 1);
//    } else {
//      this.cartService.remove(item.product_id);
//    }
//  }
//
//  checkout() {
//    console.log("Proceeding to checkout...");
//    // navigate to checkout page later
//  }
//}
