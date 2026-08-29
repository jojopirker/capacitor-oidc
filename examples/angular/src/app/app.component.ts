import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { OidcService } from './oidc.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly oidc = inject(OidcService);

  ngOnInit() {
    void this.oidc.initialize().catch((error: unknown) => {
      this.oidc.message.set(error instanceof Error ? error.message : String(error));
    });
  }
}
