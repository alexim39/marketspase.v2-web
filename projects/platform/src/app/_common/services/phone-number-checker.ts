import { AbstractControl, ValidatorFn } from '@angular/forms';


export function minDigitsValidator(minDigits: number): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      if (control.value && control.value.toString().length < minDigits) {
        return { minDigits: { requiredLength: minDigits, actualLength: control.value.toString().length } };
      }
      return null;
    };
  }