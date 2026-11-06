import { Pipe, PipeTransform } from '@angular/core';  

@Pipe({  
  name: 'truncate',  
  standalone: true  
})  
export class TruncatePipe implements PipeTransform {  
  transform(value: string | null | undefined, limit = 100): string {  
    // Check if value is null or undefined and return an empty string, or a default message  
    if (value == null) {  
      return ''; // or return 'No content' if you prefer a default message  
    }  

    // Proceed with the truncation if value is a string  
    return value.length > limit ? `${value.substring(0, limit)}...` : value;  
  }  
}