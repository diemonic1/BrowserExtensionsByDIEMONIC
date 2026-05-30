
function getStoredResume() {
  return new Promise(resolve => {
    chrome.storage.local.get({ resumeText: "" }, data => {
      resolve((data.resumeText || "").trim());
    });
  });
}

async function OpenGenerator() {
  const resume = await getStoredResume();

  let vacancy_title = document.querySelector('[data-qa="vacancy-title"]');
  let vacancy_description = document.querySelector('[data-qa="vacancy-description"]');

  vacancy_title = vacancy_title.innerHTML.replace(/<\/?[^>]+(>|$)/g, "");
  vacancy_description = vacancy_description.innerHTML.replace(/<\/?[^>]+(>|$)/g, "");

  const message = `
  Ты пишешь короткие сопроводительные письма для российского рынка труда. Пиши как живой человек - естественно, но профессионально. Избегай шаблонов, формальностей и американских клише. НЕ упоминай зарплату, компенсацию или деньги - это неуместно. Фокусируйся на конкретных технологиях и опыте. Пиши в российском стиле.
  Напиши короткое сопроводительное письмо на основе резюме и вакансии. 

  РЕЗЮМЕ: 
  ` + resume + `
  
  НАЗВАНИЕ ВАКАНСИИ:
  ` + vacancy_title + `

  ОПИСАНИЕ ВАКАНСИИ: 
  ` + vacancy_description + `
  
  Правила: - Начинай с "Здравствуйте! Заинтересовала ваша вакансия" - Максимум 2 абзаца - Пиши как живой человек - естественно и без формальностей - Упомяни конкретные технологии и проекты из резюме - Покажи, что читал вакансию - упомяни название позиции, но НЕ название компании - Свяжи свой опыт с требованиями вакансии - Используй живые фразы: "хочется", "интересно", "готов" - Избегай: "выразить интерес", "отличная возможность", "профессиональный рост", "компенсация", "заработная плата" - НЕ упоминай названия компаний/проектов - пиши про технологии и задачи - НЕ пиши про зарплату, деньги, компенсацию - это неуместно в сопроводительном письме - Пиши от первого лица - Закончи естественно, без "С уважением" - НЕ придумывай лишние детали - Пиши в российском стиле - без американских клише Пример стиля: "Здравствуйте! Заинтересовала ваша вакансия Node.js-разработчика — у меня есть реальные проекты на Node.js и TypeScript. Строил микросервисный бэкенд на NestJS с PostgreSQL, делал gRPC-интеграции и AI-классификацию, писал Telegram-бота с оплатами и API Gateway. Хочется применять эти технологии в новых проектах." Дополнительные примеры российского стиля: - "Интересно поработать с вашей командой над проектами на React" - "Готов обсудить детали и рассказать о своем опыте" - "Хочется развиваться в направлении фронтенд-разработки" - "Готов приступить к работе и показать результат" Ответ: только текст письма.
  `;


  navigator.clipboard.writeText(message)
    .then(() => {
      window.open("https://chatgpt.com");
    })
    .catch(err => {
      console.log('Something went wrong', err);
    });


}

window.onload = function () {
  var div = document.createElement('div'); // Создаёт блок  
  div.id = "HHLetterGeneratorContainer";

  div.innerHTML = `
  <div 
      style="
          opacity: 1;
          color: white;
          margin: 0px 9px;
          position: fixed;
          right: 20px;
          bottom: 20px;
          background-color: #252525;
          border-radius: 20px;
          padding: 10px;
          cursor: pointer;
	  z-index: 50000;
      "
      id="HHLetterGeneratorContainer"
      >
      сгенерировать письмо
  </div>`;

  document.getElementById('HH-React-Root').appendChild(div);
  document.getElementById('HHLetterGeneratorContainer').onclick = OpenGenerator;
};
