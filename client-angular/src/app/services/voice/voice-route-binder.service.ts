import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { VoiceSessionService } from './voice-session.service';

@Injectable({ providedIn: 'root' })
export class VoiceRouteBinderService {
  constructor(private router: Router, private session: VoiceSessionService) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.applyRoute());
    this.applyRoute();
  }

  private applyRoute(): void {
    const url = this.router.url;

//    if (url.includes('/crm/opportunities/create')) {
//      this.session.setActive('opportunity-create');
//      return;
//    }
    if (url.includes('/orders')) {
      this.session.setActive('orders');
      return;
    }
    if (url.includes('/store/c')) {
      this.session.setActive('products');
      return;
    }
    // default (no voice context)
    this.session.setActive(undefined);
  }
}
