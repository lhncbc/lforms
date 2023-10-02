import { Component, OnInit, Input } from '@angular/core';
import { LhcDataService} from '../../lib/lhc-data.service';

@Component({
  selector: 'lhc-button-popover',
  templateUrl: './lhc-button-popover.component.html',
  styleUrls: ['./lhc-button-popover.component.css']
})
export class LhcButtonPopoverComponent {

  @Input() item: any;
  @Input() popoverType: string;
  @Input() formLevel: boolean = false;
  @Input() buttonLabel: string = null;
  @Input() append: boolean = false;
  constructor(private lhcDataService: LhcDataService) { }


  /**
   * Send the popover content to screen reader log when the popover button is clicked
   */
  onShowingPopver(): void {
    let title = this.popoverType === "copyright-string" ? "Copyright notice:" : "Info:"
    let content, contentId;

    if (this.popoverType === "copyright-string") {
      title = "Copyright notice:"
      contentId = "copyright-content-" + (this.formLevel ? this.item.code : this.item._elementId);
    }
    else {
      title = "Info:"
      contentId = "help-content-" + (this.formLevel ? this.item.code : this.item._elementId);
    }

    setTimeout(() => {
      // get the displayed text instead of possible HTML content
      let content = document.getElementById(contentId).textContent;
      this.lhcDataService.sendMsgToScreenReader(`${title} ${content}`)
    }, 10)
  }
}
