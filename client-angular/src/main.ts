import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';

import { AppComponent } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter(routes, withEnabledBlockingInitialNavigation()),

    // ✅ REQUIRED for ngx-lottie (Standalone Angular)
    provideLottieOptions({
      player: () => player
    })
  ]
});
